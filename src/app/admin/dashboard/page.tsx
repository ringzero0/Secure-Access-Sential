
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileCheck, Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { getUsersCount, getPendingRequestsCount, getRecentActivitiesCount, getDailyActivityCounts, type DailyActivityCount } from "@/actions/adminActions";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart as BarChartIcon } from "lucide-react"; 

interface DashboardSummaryData {
  totalUsers: number;
  pendingRequests: number;
  recentActivities: number;
}

const chartConfig = {
  activities: {
    label: "Activities",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [activityChartData, setActivityChartData] = useState<DailyActivityCount[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [usersCount, pendingCount, activitiesCount, dailyActivities] = await Promise.all([
          getUsersCount(),
          getPendingRequestsCount(),
          getRecentActivitiesCount(24), 
          getDailyActivityCounts(7) 
        ]);
        setSummaryData({
          totalUsers: usersCount,
          pendingRequests: pendingCount,
          recentActivities: activitiesCount,
        });
        setActivityChartData(dailyActivities);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setSummaryData({ totalUsers: 0, pendingRequests: 0, recentActivities: 0 }); 
        setActivityChartData([]); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {user?.name || 'Admin'}!</h1>
      <p className="text-muted-foreground">Here's an overview of your Secure Access Sentinel system.</p>

      {isLoading && !summaryData ? ( 
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/4 mb-1" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-1/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryData ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Managed users in the system</p>
              <Link href="/admin/users" className="text-sm text-primary hover:underline mt-2 block">View Users</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Access Requests</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.pendingRequests}</div>
              <p className="text-xs text-muted-foreground">File access requests awaiting approval</p>
              <Link href="/admin/requests" className="text-sm text-primary hover:underline mt-2 block">Manage Requests</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.recentActivities}</div>
              <p className="text-xs text-muted-foreground">Logged events in the last 24 hours</p>
              <Link href="/admin/activity" className="text-sm text-primary hover:underline mt-2 block">View Activity Log</Link>
            </CardContent>
          </Card>
        </div>
      ) : (
         <p className="text-muted-foreground">Could not load dashboard summary data.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Activity Overview (Last 7 Days)</CardTitle>
          <CardDescription>Daily activity counts for the past week.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] pt-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground flex flex-col justify-center items-center h-full">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <p className="mt-2">Loading chart data...</p>
            </div>
          ) : activityChartData && activityChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={activityChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                    fontSize={12}
                  />
                  <ChartTooltip
                    cursor={true}
                    content={<ChartTooltipContent labelClassName="font-semibold" indicator="dot" />}
                  />
                  <Bar dataKey="activities" fill="var(--color-activities)" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="text-center text-muted-foreground flex flex-col justify-center items-center h-full">
              <BarChartIcon className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
              <p>No activity data to display for the past 7 days.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-muted rounded ${className}`} />
);
