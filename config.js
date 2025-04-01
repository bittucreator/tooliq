// Secure configuration file for API credentials
// IMPORTANT: Add this file to .gitignore to prevent committing credentials

export const FIGMA_CONFIG = {
  CLIENT_ID: "rdUnOmCxVqTGWtq8ISltJn",
  CLIENT_SECRET: "QibilwDBl7vgmhqOJzjRNeGYMJjTFi",
  REDIRECT_URI: "https://openbase.studio/",
  // Store the client secret securely - consider using a backend service
  // for the OAuth token exchange instead of storing it in the extension
}

export const SUPABASE_CONFIG = {
  URL: "https://your-supabase-project.supabase.co",
  ANON_KEY: "your-supabase-anon-key",
  // The anon key is safe to include in client-side code
  // as it has limited permissions set in Supabase
}

export const STRIPE_CONFIG = {
  PUBLIC_KEY: "pk_test_your_stripe_public_key",
  WEBHOOK_SECRET: "whsec_your_webhook_secret",
  // The webhook secret should be kept server-side only
  // It's included here for reference but should be used in a secure backend
}

export const SUBSCRIPTION_PLANS = {
  MONTHLY: {
    PRICE_ID: "price_monthly_id",
    NAME: "Monthly Premium",
    PRICE: 15,
    INTERVAL: "month",
  },
  ANNUAL: {
    PRICE_ID: "price_annual_id",
    NAME: "Annual Premium",
    PRICE: 150,
    INTERVAL: "year",
  },
}

