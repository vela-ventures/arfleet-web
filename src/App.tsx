import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, CloudUpload, Home, Package, ShoppingCart, Users, Server } from "lucide-react"
import { Link as RouterLink } from 'react-router-dom'
import { ConnectButton } from "arweave-wallet-kit"
import WalletWrapper from './components/WalletWrapper'
import MyArFleet from './components/MyArFleet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import lineData from './store/lines'
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
import { ArFleetProvider, useArFleet } from './contexts/ArFleetContext';
import WallOfLines from './components/WallOfLines'

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
  const [activeLink, setActiveLink] = useState("/")
  const [theme] = useLocalStorageState('theme', {
    defaultValue: 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <WalletWrapper>
      <ArFleetProvider>
        <Router>
          <AppContent setActiveLink={setActiveLink} activeLink={activeLink} theme={theme} />
        </Router>
      </ArFleetProvider>
    </WalletWrapper>
  )
}

function Header({ theme }) {
  const { arConnected, devMode, resetAODB } = useArFleet();
  
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
        className={`${buttonStyle.className} h-9`}
      />

      <ThemeToggle />

      {devMode && (
        <Button onClick={resetAODB} variant="outline" size="sm">
          Reset AODB
        </Button>
      )}

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
  const { arConnected } = useArFleet();

  useEffect(() => {
    setActiveLink(location.pathname)
  }, [location, setActiveLink])

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar activeLink={activeLink} />
      <div className="flex flex-col h-screen overflow-hidden">
        <Header theme={theme} />

        <div className="flex-1 overflow-auto">
          {arConnected ? (
            <Routes>
              {links.map((link) => (
                <Route key={link.href} path={link.href} element={link.component} />
              ))}
            </Routes>
          ) : (
            <div className="flex justify-center items-center h-full bg-white dark:bg-gray-800 font-RobotoMono relative">

              <Card className="w-[350px] shadow-lg shadow-gray-400 dark:shadow-gray-500 dark:shadow-sm z-10">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <img 
                      src="/arfleet-logo-square.png" 
                      style={{ filter: theme === 'dark' ? "invert(1) grayscale(1) opacity(0.5)" : "" }}
                      alt="ArFleet Logo" 
                      className="w-24 h-24 md:w-32 md:h-32"
                    />
                  </div>
                  <CardTitle className="text-2xl font-bold text-center">Welcome to ArFleet</CardTitle>
                  <CardDescription className="text-center">Connect your ArWeave wallet to get started</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300 text-center">
                  </p>
                  <ConnectButton className="w-full" />
                </CardContent>
              </Card>

              <WallOfLines
                className={"absolute inset-0 w-full h-full z-0 " + (theme === 'dark' ? "opacity-30" : "")}
                lines={lineData}
                minDelay={50}
                maxDelay={600}
                colors={theme === 'dark' ? ["#FF9797", "#8886FF", "#4BC24B"] : ["#FF9797", "#8886FF", "#4BC24B"]}
                primaryColor={theme === 'dark' ? "#557799" : "#C8CCD8"}
              />

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Sidebar({ activeLink }) {
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <RouterLink to="/" className="flex items-center gap-2 font-semibold logo-link">
            <img src="/arfleet-logo-square.png" className="h-6" alt="ArFleet Logo" />
            <span className="text-2xl font-extralight bg-clip-text text-transparent">ArFleet</span>
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
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

export default App