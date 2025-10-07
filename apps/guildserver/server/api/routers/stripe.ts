import {
	findServersByUserId,
	findUserById,
	IS_CLOUD,
	STRIPE_ENABLED,
	updateUser,
} from "@guildserver/server";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod";
import { getStripeItems, WEBSITE_URL } from "@/server/utils/stripe";
import { adminProcedure, createTRPCRouter } from "../trpc";

const STRIPE_API_VERSION = "2024-09-30.acacia";

const getStripeClient = () => {
	if (!STRIPE_ENABLED) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Stripe billing is disabled.",
		});
	}

	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Stripe secret key is not configured.",
		});
	}

	return new Stripe(secretKey, {
		apiVersion: STRIPE_API_VERSION,
	});
};

export const stripeRouter = createTRPCRouter({
	getProducts: adminProcedure.query(async ({ ctx }) => {
		const user = await findUserById(ctx.user.ownerId);
		const stripeCustomerId = user.stripeCustomerId;

		const stripe = getStripeClient();

		const products = await stripe.products.list({
			expand: ["data.default_price"],
			active: true,
		});

		if (!stripeCustomerId) {
			return {
				products: products.data,
				subscriptions: [],
			};
		}

		const subscriptions = await stripe.subscriptions.list({
			customer: stripeCustomerId,
			status: "active",
			expand: ["data.items.data.price"],
		});

		return {
			products: products.data,
			subscriptions: subscriptions.data,
		};
	}),
	createCheckoutSession: adminProcedure
		.input(
			z.object({
				productId: z.string(),
				serverQuantity: z.number().min(1),
				isAnnual: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const stripe = getStripeClient();

			const items = getStripeItems(input.serverQuantity, input.isAnnual);
			const user = await findUserById(ctx.user.id);

			let stripeCustomerId = user.stripeCustomerId;

			if (stripeCustomerId) {
				const customer = await stripe.customers.retrieve(stripeCustomerId);

				if (customer.deleted) {
					await updateUser(user.id, {
						stripeCustomerId: null,
					});
					stripeCustomerId = null;
				}
			}

			const session = await stripe.checkout.sessions.create({
				mode: "subscription",
				line_items: items,
				...(stripeCustomerId && {
					customer: stripeCustomerId,
				}),
				metadata: {
					adminId: user.id,
				},
				allow_promotion_codes: true,
				success_url: `${WEBSITE_URL}/dashboard/settings/servers?success=true`,
				cancel_url: `${WEBSITE_URL}/dashboard/settings/billing`,
			});

			return { sessionId: session.id };
		}),
	createCustomerPortalSession: adminProcedure.mutation(async ({ ctx }) => {
		const user = await findUserById(ctx.user.id);

		if (!user.stripeCustomerId) {
			console.error("Stripe portal error: Missing stripeCustomerId for user", {
				userId: user.id,
				email: (user as any)?.email,
			});
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Stripe Customer ID not found",
			});
		}
		const stripeCustomerId = user.stripeCustomerId;

		const stripe = getStripeClient();

		try {
			console.log("Creating Stripe customer portal session", {
				userId: user.id,
				stripeCustomerId,
				websiteUrl: WEBSITE_URL,
				mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
					? "live"
					: "test",
			});
			const session = await stripe.billingPortal.sessions.create({
				customer: stripeCustomerId,
				return_url: `${WEBSITE_URL}/dashboard/settings/billing`,
				...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
					? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
					: {}),
			});
			console.log("Stripe customer portal session created", {
				sessionId: session.id,
				urlPresent: Boolean(session.url),
			});
			return { url: session.url };
		} catch (_) {
			console.error("Stripe portal creation failed", _);
			return {
				url: "",
			};
		}
	}),

	canCreateMoreServers: adminProcedure.query(async ({ ctx }) => {
		const user = await findUserById(ctx.user.ownerId);
		const servers = await findServersByUserId(user.id);

		if (!IS_CLOUD || !STRIPE_ENABLED) {
			return true;
		}

		return servers.length < user.serversQuantity;
	}),
});
