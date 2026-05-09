import { login } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="w-full max-w-sm">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-foreground/40">
          {t("client_access")}
        </p>
        <h1 className="text-4xl font-semibold">{t("login_title")}</h1>

        {error && (
          <p className="mt-6 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
            {error}
          </p>
        )}

        <form action={login} className="mt-10 space-y-6">
          <div className="space-y-4">
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-12 w-full border-b border-border bg-transparent outline-none placeholder:text-foreground/30 focus:border-primary transition-colors"
              placeholder={t("email_placeholder")}
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 w-full border-b border-border bg-transparent outline-none placeholder:text-foreground/30 focus:border-primary transition-colors"
              placeholder={t("password_placeholder")}
            />
          </div>
          <button
            type="submit"
            className="h-11 w-full rounded-[7px] bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            {t("submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
