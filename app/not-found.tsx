import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon and illustration */}
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>

          {/* 404 Message */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">404</h1>
            <h2 className="text-xl font-semibold text-foreground">
              Page Not Found
            </h2>
            <p className="text-muted-foreground">
              The page you&rsquo;re looking for doesn&rsquo;t exist. It might have been deleted or the link is incorrect.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/chat">
              <MessageCircle className="w-4 h-4" />
              Start New Conversation
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go to Home
            </Link>
          </Button>
        </div>

        {/* Additional help text */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Need help? Contact our support team or check your chat history.
          </p>
        </div>
      </div>
    </div>
  );
}
