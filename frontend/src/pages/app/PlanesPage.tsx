import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPaymentLink, getPlans } from '../../lib/admin-api';
import { brand } from '../../lib/brand';

type PlanWithLink = {
  id: string;
  name: string;
  monthlyPrice: number;
  annualDiscountPct: number;
  features: string[];
  priority: number;
  paymentUrl: string;
};

export function PlanesPage() {
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<PlanWithLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const professionalId = useMemo(() => searchParams.get('pro')?.trim() ?? '', [searchParams]);

  useEffect(() => {
    if (!professionalId) {
      setError('Link invalido: falta el profesional.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getPlans();
        const activePlans = response.data.filter((plan) => plan.isActive);

        const plansWithLinks = await Promise.all(
          activePlans.map(async (plan) => {
            const linkResponse = await getPaymentLink(professionalId, plan.id);

            return {
              id: plan.id,
              name: plan.name,
              monthlyPrice: plan.monthlyPrice,
              annualDiscountPct: plan.annualDiscountPct,
              features: Array.isArray(plan.features) ? plan.features : [],
              priority: (plan as { priority?: number }).priority ?? 1,
              paymentUrl: linkResponse.data.url,
            };
          }),
        );

        const sorted = plansWithLinks.sort((a, b) => a.priority - b.priority);
        setPlans(sorted);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No pudimos cargar los planes.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [professionalId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white text-zinc-900">
      <header className="border-b border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <img src="/logo-nora.svg" alt={brand.name} className="h-14 w-auto" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-8 sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Elegi tu plan y activa tu membresia
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
            Una vez confirmado el pago, tu membresia se activa y podes volver a recibir pedidos.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm"
              >
                <div className="h-5 w-28 rounded bg-emerald-100" />
                <div className="mt-4 h-9 w-36 rounded bg-emerald-100" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full rounded bg-emerald-50" />
                  <div className="h-4 w-4/5 rounded bg-emerald-50" />
                  <div className="h-4 w-3/5 rounded bg-emerald-50" />
                </div>
                <div className="mt-8 h-10 w-full rounded-xl bg-emerald-100" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && plans.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No hay planes activos para mostrar en este momento.
          </div>
        )}

        {!error && !loading && plans.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
                  {plan.annualDiscountPct > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {plan.annualDiscountPct}% OFF anual
                    </span>
                  )}
                </div>

                <p className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
                  ${plan.monthlyPrice.toLocaleString('es-AR')}
                  <span className="ml-1 text-base font-medium text-zinc-500">/mes</span>
                </p>

                {plan.features.length > 0 && (
                  <ul className="mt-4 space-y-2 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => window.open(plan.paymentUrl, '_blank', 'noopener,noreferrer')}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Contratar {'->'}
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
