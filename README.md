# Tokenizas Dominicana

Demo en Node.js + SQLite para una plataforma de tokenizacion inmobiliaria en Solana.

## Ejecutar en desarrollo

```powershell
C:\Users\chago\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd install
C:\Users\chago\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe src\seed.js
.\start-local.ps1
```

Abrir `http://localhost:3000`.

En una maquina con Node.js instalado normalmente:

```bash
npm install
npm run seed
npm start
```

## Incluye

- Catalogo de proyectos inmobiliarios.
- Pagina de detalle por proyecto.
- Flujo de orden de inversion de prueba.
- Dashboard de inversionista.
- Back office con KYC/KYB, capital levantado y auditoria.
- Seeder con proyectos, usuarios, documentos, ofertas, inversiones, distribuciones, wallets, mints y balances tokenizados.
- Modo Solana testnet real para crear mints SPL y emitir tokens cuando se configura una wallet pagadora.
- Healthcheck en `/health`.

## Solana testnet

Por defecto el proyecto corre en modo demo para que el seeder funcione sin fondos. Para crear mints y emitir tokens reales en Solana testnet, configura estas variables en `.env`:

```bash
SOLANA_CLUSTER=testnet
SOLANA_RPC_URL=https://api.testnet.solana.com
SOLANA_PAYER_SECRET_KEY=[12,34,...]
SOLANA_TOKEN_DECIMALS=0
```

`SOLANA_PAYER_SECRET_KEY` debe ser el arreglo JSON de la llave privada de una wallet de testnet con SOL de prueba. Esa wallet sera la autoridad del mint y pagara las transacciones. Despues ejecuta:

```bash
npm install
npm run seed
systemctl restart tokenizas-dominicana
```

El panel `/admin/tokenization` usara testnet real cuando esa llave exista. Sin esa llave mantiene el modo demo.

## Despliegue

Ver [DEPLOY_UBUNTU.md](DEPLOY_UBUNTU.md) para subirlo a GitHub e instalarlo en Ubuntu/Contabo con systemd, Nginx, dominio y HTTPS.

## Nota

El modo testnet usa SPL Token basico. Para produccion se debe completar Solana Token Extensions, Transfer Hook, multisig, custodia, monitoreo on-chain y auditoria legal/tecnica.
