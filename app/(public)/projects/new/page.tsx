"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Play, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getApiKeysFromStorage } from "@/hooks/use-api-keys";

const VISUAL_STYLES = [
  { value: "wes-anderson", label: "Wes Anderson", description: "Symmetrical, pastel palette, whimsical nostalgia" },
  { value: "classic-noir", label: "Classic Film Noir", description: "Black & white, high contrast, shadows" },
  { value: "70s-crime-drama", label: "The Godfather Style", description: "Warm amber, low-key lighting, operatic" },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [selectedStyle, setSelectedStyle] = useState<string>("wes-anderson");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"pdf" | "text">("pdf");
  const [autoMode, setAutoMode] = useState(true);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      if (!projectTitle) {
        setProjectTitle(file.name.replace(".pdf", ""));
      }
    }
  };

  const handleSubmit = async (inputType: "pdf" | "text"): Promise<void> => {
    setIsSubmitting(true);
    try {
      let scriptContent = "";
      let fileData: ArrayBuffer | undefined = undefined;

      // Get script content based on input type
      if (inputType === "pdf" && pdfFile) {
        // Read PDF file as ArrayBuffer for proper upload
        fileData = await pdfFile.arrayBuffer();
        scriptContent = ""; // Not needed for PDF - we'll use the URL
      } else if (inputType === "text" && pastedText) {
        scriptContent = pastedText;
      } else {
        console.error("❌ Please provide screenplay content");
        return;
      }

      // Call server action to create project and trigger n8n MCP workflow
      const { createProject } = await import("@/app/actions/projects");
      const apiKeys = getApiKeysFromStorage();
      console.log('🔑 API keys from localStorage:', {
        anthropicPresent: !!apiKeys.anthropic,
        anthropicLength: apiKeys.anthropic?.length || 0,
        kiePresent: !!apiKeys.kie,
        kieLength: apiKeys.kie?.length || 0,
      });
      const result = await createProject({
        projectName: projectTitle,
        scriptContent,
        fileData,
        visualStyle: selectedStyle,
        isPdf: inputType === "pdf",
        fileName: pdfFile?.name,
        autoMode,
        apiKeys,
      });

      if (result.success) {
        console.log("✅ Project created successfully:", result.projectId);

        // Redirect to studio - it will default to Bible page
        // The studio layout provides consistent navigation
        router.push(`/projects/${result.projectId}/studio`);
      } else {
        console.error("❌ Project creation failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Error creating project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0b] text-white relative">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-[#f5c518] animate-spin mx-auto mb-4" />
            <h2 className="font-oswald text-2xl uppercase tracking-wider text-white mb-2">
              Creating Your Rip Reel
            </h2>
            <p className="font-courier text-[#888] text-sm">
              Uploading screenplay and triggering n8n workflow...
            </p>
          </div>
        </div>
      )}

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

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title */}
        <div className="mb-12">
          <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight mb-4 text-white">
            Start Your Rip Reel
          </h1>
          <p className="font-courier text-[#888] text-lg">
            Upload screenplay or paste text → Select visual style → Generate
          </p>
        </div>

        {/* Project Title Input */}
        <div className="mb-8">
          <label
            htmlFor="project-title"
            className="block font-oswald uppercase text-sm text-[#f5c518] mb-2 tracking-wider"
          >
            Project Title
          </label>
          <input
            id="project-title"
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="Enter project title..."
            className="w-full bg-[#1c1c1f] border border-[#333] text-white px-4 py-3 font-courier focus:outline-none focus:border-[#f5c518] transition-colors"
          />
        </div>

        {/* Tabs: PDF Upload vs Text Paste */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "pdf" | "text")} className="mb-12">
          <TabsList className="grid w-full grid-cols-2 bg-[#1c1c1f] border border-[#333]">
            <TabsTrigger
              value="pdf"
              className="font-oswald uppercase tracking-wider data-[state=active]:bg-[#f5c518] data-[state=active]:text-black"
            >
              <Upload className="mr-2" size={16} />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="font-oswald uppercase tracking-wider data-[state=active]:bg-[#f5c518] data-[state=active]:text-black"
            >
              <FileText className="mr-2" size={16} />
              Paste Text
            </TabsTrigger>
          </TabsList>

          {/* PDF Upload Tab */}
          <TabsContent value="pdf" className="mt-6">
            <div className="border-2 border-dashed border-[#333] hover:border-[#f5c518] transition-colors p-12 text-center bg-[#1c1c1f]">
              <Upload className="w-16 h-16 text-[#666] mx-auto mb-4" />
              <p className="font-courier text-[#888] mb-4">
                {pdfFile
                  ? `Selected: ${pdfFile.name}`
                  : "Click to upload or drag and drop"}
              </p>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handlePdfChange}
                className="hidden"
              />
              <label htmlFor="pdf-upload">
                <Button
                  type="button"
                  onClick={() => document.getElementById("pdf-upload")?.click()}
                  className="bg-[#333] hover:bg-[#444] text-white font-oswald uppercase tracking-wider"
                >
                  Choose PDF File
                </Button>
              </label>
            </div>
          </TabsContent>

          {/* Text Paste Tab */}
          <TabsContent value="text" className="mt-6">
            <div className="bg-[#1c1c1f] border border-[#333] p-6">
              <label
                htmlFor="screenplay-text"
                className="block font-courier text-[#888] text-sm mb-2"
              >
                Paste your screenplay text below:
              </label>
              <textarea
                id="screenplay-text"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="INT. WAREHOUSE - NIGHT

A figure moves through shadows. Thunder CRACKS outside.

DETECTIVE GRAY (40s, weary)
Someone's been here recently.

He kneels, examining tire tracks..."
                rows={12}
                className="w-full bg-[#0a0a0b] border border-[#333] text-white px-4 py-3 font-courier text-sm focus:outline-none focus:border-[#f5c518] transition-colors resize-none"
              />
              <p className="text-[#666] text-xs font-courier mt-2">
                {pastedText.length} characters
                {pastedText.length > 0 && ` • ~${Math.ceil(pastedText.length / 250)} scenes estimated`}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Visual Style Selection */}
        <div className="mb-12">
          <h2 className="font-oswald uppercase text-xl text-[#f5c518] mb-4 tracking-wider">
            Select Visual Style
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VISUAL_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setSelectedStyle(style.value)}
                className={`p-4 border-2 transition-all ${
                  selectedStyle === style.value
                    ? "border-[#f5c518] bg-[#f5c518]/10"
                    : "border-[#333] hover:border-[#555]"
                }`}
              >
                <h3 className="font-oswald uppercase text-sm mb-1 text-white">
                  {style.label}
                </h3>
                <p className="font-courier text-xs text-[#888]">
                  {style.description}
                </p>
              </button>
            ))}
          </div>

          {/* Auto Mode Checkbox */}
          <div className="flex items-center space-x-3 mt-6 p-4 bg-[#1c1c1f] border border-[#333] rounded">
            <Checkbox
              id="autoMode"
              checked={autoMode}
              onCheckedChange={(checked) => setAutoMode(checked === true)}
              className="border-[#f5c518] data-[state=checked]:bg-[#f5c518] data-[state=checked]:text-black"
            />
            <Label
              htmlFor="autoMode"
              className="text-sm text-[#ccc] font-courier cursor-pointer"
            >
              <span className="text-[#f5c518] font-oswald uppercase tracking-wider">Auto Mode</span>
              <span className="ml-2">— Automatically generate portraits and locations after parsing</span>
            </Label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => handleSubmit(activeTab)}
            disabled={
              isSubmitting ||
              !projectTitle ||
              (activeTab === "pdf" ? !pdfFile : !pastedText)
            }
            className="inline-flex items-center gap-3 bg-[#e02f2f] hover:bg-red-600 text-white font-oswald text-xl uppercase tracking-widest px-12 py-6 transition-all hover:scale-105 shadow-2xl shadow-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Play fill="currentColor" size={20} />
            Create Rip Reel
          </Button>
        </div>

        {/* Validation Message */}
        {!projectTitle && (
          <p className="text-center text-[#666] font-courier text-sm mt-4">
            Enter a project title to continue
          </p>
        )}
        {projectTitle && !pdfFile && !pastedText && (
          <p className="text-center text-[#666] font-courier text-sm mt-4">
            Upload a PDF or paste screenplay text to continue
          </p>
        )}
      </div>
    </div>
  );
}
