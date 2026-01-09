"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Upload, BookOpen } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6 flex flex-col h-full">
          <div className="flex items-center mb-4">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold">Your Calendar</h2>
          </div>
          <p className="text-gray-600 mb-6">
            View and manage all your academic events in one place.
          </p>
          <div className="mt-auto">
            <Link href="/calendar">
              <Button className="w-full">
                Go to Calendar
              </Button>
            </Link>
          </div>
        </Card>
        
        <Card className="p-6 flex flex-col h-full">
          <div className="flex items-center mb-4">
            <Upload className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold">Add Events</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Upload a syllabus, assignment sheet or course document to automatically extract events.
          </p>
          <div className="mt-auto">
            <Link href="/calendar">
              <Button className="w-full">
                Upload Document
              </Button>
            </Link>
          </div>
        </Card>
      </div>
      
      
      {/* Additional Dashboard Content */}
      <div className="mt-10">
        <Card className="p-6 border-dashed border-2">
          <div className="flex items-center mb-4">
            <BookOpen className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold">Tips for Success</h2>
          </div>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Upload syllabi at the beginning of each semester to get all important dates</li>
            <li>Use the Canvas sync feature to automatically import all your assignments</li>
            <li>Check your calendar daily to stay on top of upcoming deadlines</li>
            <li>Organize events by priority to focus on what matters most</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}