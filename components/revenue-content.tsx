"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingUp, Users, CreditCard, Calendar, Plus, Package } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AddClientPanel from "./add-client-panel"
import SubscriptionPlansPanel from "./subscription-plans-panel"

export default function RevenueContent() {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [isSubscriptionPlansOpen, setIsSubscriptionPlansOpen] = useState(false)

  const handleOpenAddClient = () => {
    setIsSubscriptionPlansOpen(false)
    setIsAddClientOpen(true)
  }

  const handleOpenSubscriptionPlans = () => {
    setIsAddClientOpen(false)
    setIsSubscriptionPlansOpen(true)
  }

  const revenueStats = {
    totalRevenue: 24750,
    monthlyRevenue: 8250,
    activeClients: 15,
    averagePerClient: 550,
  }

  const clientRevenue = [
    {
      id: 1,
      name: "Marcus Johnson",
      email: "marcus.j@email.com",
      totalPaid: 2400,
      lastPayment: "2024-01-15",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 2,
      name: "Sarah Williams",
      email: "sarah.w@email.com",
      totalPaid: 1800,
      lastPayment: "2024-01-14",
      status: "Active",
      plan: "Standard",
    },
    {
      id: 3,
      name: "David Chen",
      email: "david.c@email.com",
      totalPaid: 3200,
      lastPayment: "2024-01-13",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 4,
      name: "Emily Rodriguez",
      email: "emily.r@email.com",
      totalPaid: 1500,
      lastPayment: "2023-12-20",
      status: "Not Active",
      plan: "Standard",
    },
    {
      id: 5,
      name: "James Thompson",
      email: "james.t@email.com",
      totalPaid: 2800,
      lastPayment: "2024-01-11",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 6,
      name: "Lisa Anderson",
      email: "lisa.a@email.com",
      totalPaid: 1200,
      lastPayment: "2023-11-15",
      status: "Not Active",
      plan: "Basic",
    },
    {
      id: 7,
      name: "Michael Brown",
      email: "michael.b@email.com",
      totalPaid: 2600,
      lastPayment: "2024-01-09",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 8,
      name: "Jennifer Davis",
      email: "jennifer.d@email.com",
      totalPaid: 1900,
      lastPayment: "2024-01-08",
      status: "Active",
      plan: "Standard",
    },
    {
      id: 9,
      name: "Robert Wilson",
      email: "robert.w@email.com",
      totalPaid: 3500,
      lastPayment: "2024-01-07",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 10,
      name: "Amanda Martinez",
      email: "amanda.m@email.com",
      totalPaid: 1650,
      lastPayment: "2023-12-10",
      status: "Not Active",
      plan: "Standard",
    },
    {
      id: 11,
      name: "Christopher Lee",
      email: "chris.l@email.com",
      totalPaid: 2900,
      lastPayment: "2024-01-05",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 12,
      name: "Jessica Taylor",
      email: "jessica.t@email.com",
      totalPaid: 1400,
      lastPayment: "2024-01-04",
      status: "Active",
      plan: "Standard",
    },
    {
      id: 13,
      name: "Daniel Garcia",
      email: "daniel.g@email.com",
      totalPaid: 3100,
      lastPayment: "2024-01-03",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 14,
      name: "Michelle White",
      email: "michelle.w@email.com",
      totalPaid: 1100,
      lastPayment: "2023-11-28",
      status: "Not Active",
      plan: "Basic",
    },
    {
      id: 15,
      name: "Kevin Harris",
      email: "kevin.h@email.com",
      totalPaid: 2500,
      lastPayment: "2024-01-02",
      status: "Active",
      plan: "Premium",
    },
    {
      id: 16,
      name: "Nicole Clark",
      email: "nicole.c@email.com",
      totalPaid: 1750,
      lastPayment: "2024-01-01",
      status: "Active",
      plan: "Standard",
    },
    {
      id: 17,
      name: "Brian Lewis",
      email: "brian.l@email.com",
      totalPaid: 950,
      lastPayment: "2023-12-05",
      status: "Not Active",
      plan: "Basic",
    },
    {
      id: 18,
      name: "Stephanie Walker",
      email: "stephanie.w@email.com",
      totalPaid: 2200,
      lastPayment: "2023-12-31",
      status: "Active",
      plan: "Standard",
    },
  ]

  const filteredClients = clientRevenue.filter((client) => {
    if (statusFilter === "all") return true
    if (statusFilter === "active") return client.status === "Active"
    if (statusFilter === "inactive") return client.status === "Not Active"
    return true
  })

  const recentTransactions = [
    {
      id: 1,
      client: "Marcus Johnson",
      amount: 300,
      date: "2024-01-15",
      type: "Monthly Subscription",
    },
    {
      id: 2,
      client: "Sarah Williams",
      amount: 200,
      date: "2024-01-14",
      type: "Monthly Subscription",
    },
    {
      id: 3,
      client: "David Chen",
      amount: 350,
      date: "2024-01-13",
      type: "Monthly Subscription",
    },
    {
      id: 4,
      client: "Emily Rodriguez",
      amount: 200,
      date: "2024-01-12",
      type: "Monthly Subscription",
    },
    {
      id: 5,
      client: "James Thompson",
      amount: 300,
      date: "2024-01-11",
      type: "Monthly Subscription",
    },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={`transition-all duration-300 ease-in-out ${isAddClientOpen || isSubscriptionPlansOpen ? "w-[60%]" : "w-full"} overflow-y-auto`}
      >
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 pl-12">
              <h1 className="text-4xl font-bold mb-2">Revenue</h1>
              <p className="text-muted-foreground text-lg">Track your earnings and client payments</p>
            </div>

            <div className="space-y-6">
              {/* Revenue Stats Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenueStats.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <TrendingUp className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenueStats.monthlyRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                    <Users className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{revenueStats.activeClients}</div>
                    <p className="text-xs text-muted-foreground mt-1">Paying subscribers</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg per Client</CardTitle>
                    <CreditCard className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenueStats.averagePerClient)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Monthly average</p>
                  </CardContent>
                </Card>
              </div>

              {/* Client Revenue Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Revenue by Client</CardTitle>
                      <CardDescription>Total earnings from each client</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Tabs
                        value={statusFilter}
                        onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
                      >
                        <TabsList>
                          <TabsTrigger value="all">All</TabsTrigger>
                          <TabsTrigger value="active">Active</TabsTrigger>
                          <TabsTrigger value="inactive">Not Active</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Button onClick={handleOpenSubscriptionPlans} variant="outline" className="gap-2 bg-transparent">
                        <Package className="size-4" />
                        Subscription Plans
                      </Button>
                      <Button onClick={handleOpenAddClient} className="gap-2">
                        <Plus className="size-4" />
                        Add Client
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Last Payment</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-muted-foreground">{client.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                client.plan === "Premium"
                                  ? "default"
                                  : client.plan === "Standard"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {client.plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(client.totalPaid)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(client.lastPayment)}</TableCell>
                          <TableCell>
                            {client.status === "Active" ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                                In Active Session
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-500/20">
                                Not Active
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="size-5" />
                    Recent Transactions
                  </CardTitle>
                  <CardDescription>Latest payments received from clients</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">{transaction.client}</TableCell>
                          <TableCell className="text-muted-foreground">{transaction.type}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(transaction.date)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            +{formatCurrency(transaction.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <AddClientPanel isOpen={isAddClientOpen} onToggle={() => setIsAddClientOpen(!isAddClientOpen)} />
      <SubscriptionPlansPanel
        isOpen={isSubscriptionPlansOpen}
        onToggle={() => setIsSubscriptionPlansOpen(!isSubscriptionPlansOpen)}
      />
    </div>
  )
}
