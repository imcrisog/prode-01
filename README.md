This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Demo: sitio minimalista de apuestas deportivas (Prode)

Funciones incluidas:

- Registro / Login (demo en **localStorage**)
- Billetera: cargar saldo
  - Mercado Pago **sandbox** (crea preference server-side y redirecciona a checkout)
  - Botón **Acreditar (demo)** sin MP (por si no configurás variables)
- Apuesta: elegís solamente **qué equipo gana**
- Partido demo con duración **10 minutos**. Al terminar, se liquida automáticamente con ganador simulado y paga **2x**.

Rutas principales:

- `/login`, `/register`
- `/wallet`, `/bet`, `/account`, `/logout`
- `/mp/success`, `/mp/pending`, `/mp/failure`

### Configuración Mercado Pago (sandbox)

1) Copiá `.env.example` a `.env.local`
2) Completá el access token de pruebas:

```bash
NEXT_PUBLIC_MP_MODE=sandbox
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

#### Cómo pagar en Sandbox (muy importante)

Si al intentar pagar ves:

> “Algo salió mal… Una de las partes con la que intentás hacer el pago es de prueba.”

significa que estás intentando pagar con una **cuenta real** contra una **integración de prueba**.

Para que funcione el checkout Sandbox:

1) En Mercado Pago Developers, creá **usuarios de prueba (Test Users)**.
   - Necesitás un **comprador** (payer) de prueba.
2) Abrí el checkout en una ventana de incógnito y logueate con el **usuario comprador de prueba**.
3) Usá los **medios de pago de prueba** provistos por Mercado Pago (tarjetas de prueba, etc.).

Si el checkout dice:

> “No pudimos procesar tu pago… Usá un medio de pago distinto.”

probá con otra tarjeta/medio de pago de prueba (sandbox) o verificá que estás usando un **comprador de prueba**.
Tips rápidos:
- Usá una ventana de incógnito para evitar mezclar sesión real con sesión de prueba.
- Si seguís viendo rechazos, revisá en la doc oficial de Mercado Pago qué **tarjetas de prueba** corresponden a tu país/site.

> Nota: el token `TEST-...` pertenece al vendedor (tu app). El comprador también debe ser de prueba.

> Si no configurás `NEXT_PUBLIC_MP_MODE=sandbox`, la billetera funciona igual con el botón **Acreditar (demo)**.

### MongoDB (opcional, base preparada)

Hay un helper de conexión en `app/lib/mongodb.ts` y un endpoint de prueba:

- `GET /api/health/db`

Config:

```bash
MONGODB_URI=mongodb://localhost:27017/prode
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
