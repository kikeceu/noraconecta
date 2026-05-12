import { MercadoPagoConfig, Preference } from 'mercadopago';

let client: MercadoPagoConfig | null = null;

function getClient(): MercadoPagoConfig {
  if (!client) {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!token) {
      throw new Error(
        'MERCADOPAGO_ACCESS_TOKEN is not configured. Set it in .env to enable MercadoPago payments.',
      );
    }

    client = new MercadoPagoConfig({ accessToken: token });
  }

  return client;
}

export async function createPaymentLink(
  professionalId: string,
  planId: string,
  planName: string,
  price: number,
): Promise<string> {
  const mpClient = getClient();
  const preference = new Preference(mpClient);

  const result = await preference.create({
    body: {
      items: [
        {
          id: planId,
          title: `Membresía ${planName} - NORA`,
          quantity: 1,
          unit_price: price,
        },
      ],
      external_reference: `${professionalId}:${planId}`,
      back_urls: {
        success: process.env.MERCADOPAGO_SUCCESS_URL || '',
        failure: process.env.MERCADOPAGO_FAILURE_URL || '',
        pending: process.env.MERCADOPAGO_PENDING_URL || '',
      },
      auto_return: 'approved',
    },
  });

  if (!result.init_point) {
    throw new Error('MercadoPago did not return an init_point');
  }

  return result.init_point;
}

export async function fetchPayment(
  paymentId: string,
): Promise<{ status: string; externalReference: string | null }> {
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(
      `MercadoPago payment fetch failed: ${res.status} ${await res.text()}`,
    );
  }

  const payment = (await res.json()) as {
    status: string;
    external_reference?: string;
  };

  return {
    status: payment.status,
    externalReference: payment.external_reference || null,
  };
}
