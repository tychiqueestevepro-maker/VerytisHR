import { login } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata() {
  return { title: "Connexion | Verytis" };
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="relative min-h-screen bg-black text-white flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 border-r border-white/[0.06] bg-zinc-950 p-10">
        <Link href="/" className="flex items-center gap-2 group w-fit">
          <div className="size-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center">
            <img src="/verytisLogo.svg" alt="" className="h-3.5 w-auto invert" />
          </div>
          <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
            Verytis
          </span>
        </Link>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1">
            <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs text-indigo-300">Bêta · Accès limité</span>
          </div>
          <blockquote className="text-2xl font-bold leading-snug text-white/90">
            "Vérifiez chaque candidat.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              Recrutez avec certitude.
            </span>"
          </blockquote>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Verytis croise CVs et LinkedIn, score chaque profil sur trois axes
            et génère vos pipelines d&apos;évaluation en quelques secondes.
          </p>
        </div>

        <p className="text-xs text-zinc-700">
          © {new Date().getFullYear()} Verytis. Tous droits réservés.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="size-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center">
            <img src="/verytisLogo.svg" alt="" className="h-3.5 w-auto invert" />
          </div>
          <span className="text-sm font-semibold text-white/70">Verytis</span>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight">{t("login_title")}</h1>
          <p className="mt-2 text-sm text-zinc-500">{t("login_subtitle")}</p>

          {error && (
            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form action={login} className="mt-8 space-y-4">
            <div className="group relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder=" "
                className="peer h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 pt-5 pb-2 text-sm text-white outline-none transition-all placeholder-shown:pt-4 focus:border-indigo-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/30"
              />
              <label
                htmlFor="email"
                className="pointer-events-none absolute left-4 top-2 text-[10px] font-medium uppercase tracking-widest text-indigo-400 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-zinc-500 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-indigo-400"
              >
                {t("email_placeholder")}
              </label>
            </div>

            <div className="group relative">
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder=" "
                className="peer h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 pt-5 pb-2 text-sm text-white outline-none transition-all placeholder-shown:pt-4 focus:border-indigo-500/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/30"
              />
              <label
                htmlFor="password"
                className="pointer-events-none absolute left-4 top-2 text-[10px] font-medium uppercase tracking-widest text-indigo-400 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-zinc-500 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-indigo-400"
              >
                {t("password_placeholder")}
              </label>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-black"
            >
              {t("submit")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            {t("no_account")}{" "}
            <Link
              href="/signup"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {t("signup_link")}
            </Link>
          </p>

          <Link
            href="/"
            className="mt-10 flex items-center justify-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            <ArrowLeft className="size-3" />
            {t("back_home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
