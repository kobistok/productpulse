"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText } from "lucide-react";
import type { OrgSkill } from "@productpulse/db";
import { useRouter } from "next/navigation";

interface SkillsSectionProps {
  initialSkills: OrgSkill[];
}

export function SkillsSection({ initialSkills }: SkillsSectionProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const content = await file.text();
    const name = file.name.replace(/\.(md|txt)$/, "");

    const res = await fetch("/api/org-skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });

    if (res.ok) {
      const skill = await res.json();
      setSkills((prev) => [...prev, skill]);
      router.refresh();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/org-skills/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSkills((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
    setDeleting(null);
  }

  return (
    <div>
      {skills.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded-xl py-10 text-center">
          <p className="text-sm text-zinc-500 mb-3">No skills uploaded yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} />
            {uploading ? "Uploading..." : "Upload .md file"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <FileText size={14} className="text-zinc-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{skill.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {skill.content.length > 80
                      ? skill.content.slice(0, 80).replace(/\n/g, " ") + "..."
                      : skill.content.replace(/\n/g, " ")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(skill.id)}
                disabled={deleting === skill.id}
                className="text-zinc-400 hover:text-red-600 transition-colors shrink-0 ml-4"
                aria-label="Delete skill"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 mt-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} />
            {uploading ? "Uploading..." : "Upload .md file"}
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
