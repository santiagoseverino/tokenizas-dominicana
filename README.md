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
- Seeder con proyectos, usuarios, documentos, ofertas, inversiones, distribuciones y eventos Solana simulados.
- Healthcheck en `/health`.

## Despliegue

Ver [DEPLOY_UBUNTU.md](DEPLOY_UBUNTU.md) para subirlo a GitHub e instalarlo en Ubuntu/Contabo con systemd, Nginx, dominio y HTTPS.

## Nota

La integracion on-chain esta simulada para pruebas de producto. Para produccion se debe agregar emision real con Solana Token Extensions, Transfer Hook, multisig y auditoria legal/tecnica.
