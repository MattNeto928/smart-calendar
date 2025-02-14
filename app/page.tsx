"use client"

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GoogleIcon } from "@/components/GoogleIcon";
import { Calendar, Upload, Clock, Cloud } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/50 backdrop-blur-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-semibold">EasyCal</span>
            </div>
            <Button
              onClick={signIn}
              className="flex items-center gap-2"
            >
              <GoogleIcon />
              Sign in with Google
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight">
              Your Academic Life,{" "}
              <span className="text-blue-600">Organized</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your syllabi and course documents into a beautifully organized calendar. 
              Automatically extract dates, deadlines, and important events with AI-powered parsing.
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                onClick={signIn}
                className="text-lg px-8 py-6"
              >
                Get Started Free
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Upload className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Easy Document Upload
              </h3>
              <p className="text-gray-600">
                Simply upload your syllabus or course documents. Our AI will automatically extract all important dates and events.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Clock className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Smart Organization
              </h3>
              <p className="text-gray-600">
                Events are automatically categorized and prioritized. Tests, assignments, meetings, and office hours are color-coded for easy reference.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Cloud className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Cloud Sync
              </h3>
              <p className="text-gray-600">
                Your calendar automatically syncs across devices. Never worry about losing your schedule or missing an important deadline.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-8">
            Ready to Get Organized?
          </h2>
          <Button
            size="lg"
            onClick={signIn}
            className="text-lg px-8 py-6"
          >
            Sign in with Google
          </Button>
          <p className="mt-4 text-sm text-gray-600">
            Free for students. No credit card required.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600">EasyCal</span>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} EasyCal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
