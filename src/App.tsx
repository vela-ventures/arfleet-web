import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import { createDataItemSigner, DataItemSigner } from "@permaweb/aoconnect"
import { Bell, CloudUpload, Home, Package, ShoppingCart, Users, Server } from "lucide-react"
import { Link as RouterLink } from 'react-router-dom'
import { ConnectButton } from "arweave-wallet-kit"
import WalletWrapper from './components/WalletWrapper'
import MyArFleet from './components/MyArFleet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  CircleUser,
  LineChart,
  Menu,
  Package2,
  Search
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import useLocalStorageState from 'use-local-storage-state'
import { Moon, Sun } from "lucide-react"
import {useDropzone} from 'react-dropzone';

// Components for other routes (placeholder)
const Dashboard = () => <div>Dashboard</div>
const Orders = () => <div>Orders</div>
const Products = () => <div>Products</div>
const Customers = () => <div>Customers</div>

// Global type declarations
declare global {
  var arweaveWallet: any
  var prevConnected: boolean | null
}

const links = [
  { name: "My ArFleet", href: "/", icon: <CloudUpload className="h-4 w-4" />, component: <MyArFleet /> },
  { name: "Providers", href: "/providers", icon: <Server className="h-4 w-4" />, component: <Dashboard /> },
  { name: "Dashboard", href: "/dashboard", icon: <Home className="h-4 w-4" />, component: <Dashboard /> },
  { name: "Orders", href: "/orders", icon: <ShoppingCart className="h-4 w-4" />, component: <Orders /> },
  { name: "Products", href: "/products", icon: <Package className="h-4 w-4" />, component: <Products /> },
  { name: "Website", href: "/website", icon: <Users className="h-4 w-4" />, component: <Customers /> },
  { name: "Documentation", href: "/docs", icon: <Users className="h-4 w-4" />, component: <Customers /> },
]

function App() {
  const [arConnected, setArConnected] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [signer, setSigner] = useState<DataItemSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [activeLink, setActiveLink] = useState("/")
  const [theme] = useLocalStorageState('theme', {
    defaultValue: 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const connectWallet = async () => {
      if (globalThis.arweaveWallet) {
        const wallet_ = globalThis.arweaveWallet
        let signer_ = createDataItemSigner(wallet_)
        setSigner(signer_)
        setWallet(wallet_)

        try {
          const address_ = await wallet_.getActiveAddress()
          setAddress(address_)
          setArConnected(true)
        } catch (e) {
          console.error("Error connecting to wallet:", e)
          setArConnected(false)
        }
      } else {
        setArConnected(false)
      }
    }

    connectWallet()

    globalThis.prevConnected = null
    const interval = setInterval(async () => {
      const wallet_ = globalThis.arweaveWallet
      let curConnected = false
      if (wallet_) {
        try {
          const address_ = await wallet_.getActiveAddress()
          curConnected = !!address_
        } catch (e) {
          curConnected = false
        }
      }

      if (globalThis.prevConnected !== null && globalThis.prevConnected !== curConnected) {
        location.reload()
      } else {
        globalThis.prevConnected = curConnected
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])


function Header({ theme }) {
  const buttonStyle = theme !== 'dark' 
    ? { accent: "rgb(220, 220, 250)", className: "text-gray-700" }
    : { accent: "rgb(0, 0, 0)", className: "text-white" };

  return (
      <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col">
            <nav className="grid gap-2 text-lg font-medium">
              <RouterLink
                to="/"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <Package2 className="h-6 w-6" />
                <span className="sr-only">Acme Inc</span>
              </RouterLink>
              <RouterLink
                to="/"
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                <Home className="h-5 w-5" />
                Dashboard
              </RouterLink>
              <RouterLink
                to="/"
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl bg-muted px-3 py-2 text-foreground hover:text-foreground"
              >
                <ShoppingCart className="h-5 w-5" />
                Orders
                <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  6
                </Badge>
              </RouterLink>
              <RouterLink
                to="/"
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                <Package className="h-5 w-5" />
                Products
              </RouterLink>
              <RouterLink
                to="/"
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                <Users className="h-5 w-5" />
                Customers
              </RouterLink>
              <RouterLink
                to="/"
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                <LineChart className="h-5 w-5" />
                Analytics
              </RouterLink>
            </nav>
            <div className="mt-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Upgrade to Pro</CardTitle>
                  <CardDescription>
                    Unlock all features and get unlimited access to our
                    support team.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" className="w-full">
                    Upgrade
                  </Button>
                </CardContent>
              </Card>
            </div>
          </SheetContent>
        </Sheet>
        <div className="w-full flex-1">
          <form>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search assignments..."
                className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
              />
            </div>
          </form>
        </div>

        <ConnectButton
            accent={buttonStyle.accent}
            className={buttonStyle.className}
        />

        <ThemeToggle />

        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}
    </header>
  )
}

function AppContent({ setActiveLink, activeLink, theme }) {
  const location = useLocation()

  useEffect(() => {
    setActiveLink(location.pathname)
  }, [location, setActiveLink])

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar activeLink={activeLink} />
      <div className="flex flex-col">
        <Header theme={theme} />

        <Routes>
          {links.map((link) => (
            <Route key={link.href} path={link.href} element={link.component} />
          ))}
        </Routes>
      </div>
    </div>
  )
}

function Sidebar({ activeLink }) {
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <RouterLink to="/" className="flex items-center gap-2 font-semibold">
            <img src="/arfleet-logo.png" className="h-10" alt="ArFleet Logo" />
          </RouterLink>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {links.map((link) => (
              <RouterLink
                key={link.href}
                to={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                  activeLink === link.href ? 'bg-muted' : ''
                }`}
              >
                {link.icon}
                {link.name}
              </RouterLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Card>
            <CardHeader className="p-2 pt-0 md:p-4">
              <CardTitle>Beta Version</CardTitle>
              <CardDescription>
                ArFleet is currently in beta. Please do not upload sensitive information.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
              <p className="text-sm">
                Use with caution and report any issues you encounter.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useLocalStorageState('theme', {
    defaultValue: 'light'
  })

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

  return (
    <WalletWrapper>
      <Router>
        <AppContent setActiveLink={setActiveLink} activeLink={activeLink} theme={theme} />
      </Router>
    </WalletWrapper>
  )
}

export default App