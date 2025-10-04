# 🚀 Portfolio Tracker

A comprehensive crypto portfolio tracker with Hyperliquid integration, built with TypeScript, React, and Express.

## ✨ Features

- 📊 **Real-time Portfolio Tracking** - Monitor your crypto assets across multiple chains
- 🔥 **Hyperliquid Integration** - Track perpetual positions and balances
- 💼 **Multi-Protocol Support** - Ready for IBKR, Aster, and more DeFi protocols
- 🎨 **Modern UI** - Beautiful dashboard built with React, TailwindCSS, and shadcn/ui
- 🔐 **Secure Wallet Management** - BIP39 mnemonic-based wallet with HD derivation
- 📈 **PnL Tracking** - Monitor your 24h, 7d, and 30d performance

## 🏗️ Architecture

```
portfolio-tracker/
├── src/                    # Backend (Node.js + Express)
│   ├── server.ts          # API server
│   ├── wallet-core.ts     # Wallet management
│   ├── defi/              # DeFi protocol adapters
│   │   └── hyperliquid.ts
│   └── types/             # TypeScript types
└── client/                # Frontend (React + Vite)
    └── src/
        ├── components/    # UI components
        ├── pages/         # Page components
        └── hooks/         # React hooks
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd /Users/martinolialexandre/CascadeProjects/portfolio-tracker
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your mnemonic:
   ```
   MNEMONIC="your twelve or twenty four word mnemonic phrase"
   PORT=4000
   ```

### Running the Application

#### Option 1: Run Backend and Frontend Separately (Recommended for Development)

**Terminal 1 - Backend API Server:**
```bash
npm run server
```
The API server will start on **http://localhost:4000**

**Terminal 2 - Frontend Dev Server:**
```bash
cd client
npm run dev
```
The frontend will start on **http://localhost:3000**

#### Option 2: Build and Deploy

```bash
# Build backend
npm run build

# Build frontend
cd client
npm run build
cd ..

# Start production server
npm start
```

## 🌐 Access Points

- **Frontend Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **API Health Check:** http://localhost:4000/api/health
- **Portfolio Data:** http://localhost:4000/api/portfolio

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/portfolio` | Get portfolio summary with balances and positions |
| GET | `/api/wallet/address` | Get wallet address |

## 🔧 Configuration

### Supported Chains

The wallet core uses BIP44 derivation paths:
- Ethereum (chainId: 60)
- Hyperliquid (chainId: 1337)
- Add more chains as needed

### Adding New Protocols

1. Create a new adapter in `src/defi/`
2. Implement the balance and position fetching methods
3. Add the adapter to `src/server.ts`

## 🛠️ Tech Stack

### Backend
- **TypeScript** - Type-safe development
- **Express** - Web server framework
- **ethers.js** - Ethereum library
- **bip39** - Mnemonic generation and validation
- **@hyperliquid/sdk** - Hyperliquid integration

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **shadcn/ui** - UI components
- **Lucide React** - Icons
- **TanStack Query** - Data fetching
- **Recharts** - Charts (ready to use)

## 🔐 Security Notes

⚠️ **IMPORTANT:**
- Never commit your `.env` file
- Keep your mnemonic phrase secure
- Use environment variables for sensitive data
- Consider using hardware wallets for production

## 📝 Development Scripts

```bash
# Backend
npm run dev        # Run backend in development mode
npm run server     # Run API server
npm run build      # Build backend
npm run lint       # Lint code
npm run format     # Format code

# Frontend (in client/ directory)
npm run dev        # Run frontend dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🎯 Roadmap

- [ ] Add more DeFi protocol integrations (Aster, GMX, etc.)
- [ ] NFT portfolio tracking
- [ ] Historical price charts
- [ ] Transaction history
- [ ] Multi-wallet support
- [ ] Mobile responsive design improvements
- [ ] Dark/Light theme toggle
- [ ] Export portfolio data (CSV, PDF)
- [ ] Price alerts and notifications

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for the crypto community
