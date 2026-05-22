import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPaymentLink, getPlans } from '../../lib/admin-api';
import { brand } from '../../lib/brand';

type PlanWithLink = {
  id: string;
  name: string;
  monthlyPrice: number;
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
              paymentUrl: linkResponse.data.url,
            };
          }),
        );

        setPlans(plansWithLinks);
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
                <div className="mt-6 h-9 w-36 rounded bg-emerald-100" />
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
                className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
                <p className="mt-6 text-4xl font-bold tracking-tight text-zinc-900">
                  ${plan.monthlyPrice.toLocaleString('es-AR')}
                  <span className="ml-1 text-base font-medium text-zinc-500">/mes</span>
                </p>
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
