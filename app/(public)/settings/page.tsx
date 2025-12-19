"use client";

import Link from "next/link";
import { ArrowLeft, Key, Shield } from "lucide-react";
import { ApiKeyForm } from "@/components/settings/api-key-form";

export default function SettingsPage() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-[#333] py-6">
        <div className="container mx-auto px-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-[#888] hover:text-[#f5c518] transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="font-oswald text-2xl font-bold tracking-widest">
            ripreel<span className="text-[#f5c518]">.io</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Key className="text-[#f5c518]" size={28} />
            <h1 className="font-oswald text-3xl font-bold uppercase tracking-wider text-white">
              Settings
            </h1>
          </div>
          <p className="font-courier text-[#888]">
            Configure your API keys to use RipReel&apos;s AI features
          </p>
        </div>

        {/* API Keys Form */}
        <ApiKeyForm />

        {/* Security Note */}
        <div className="mt-8 p-4 bg-[#0a0a0b] border border-[#333] rounded">
          <div className="flex items-start gap-3">
            <Shield className="text-[#00f2ea] mt-0.5" size={18} />
            <div>
              <h3 className="font-oswald text-sm uppercase text-white mb-1">Security Note</h3>
              <p className="font-courier text-xs text-[#666] leading-relaxed">
                Your API keys are stored locally in your browser&apos;s localStorage and are never
                sent to our servers for storage. Keys are only transmitted directly to the respective
                API providers (Anthropic, Kie.ai) when you use RipReel features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
