"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteProductLineButton({ productLineId, productLineName }: { productLineId: string; productLineName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/product-lines/${productLineId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/product-lines");
      router.refresh();
    } else {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-zinc-400 hover:text-red-600 gap-1.5"
      >
        <Trash2 size={13} /> Delete
      </Button>
      <Dialog
        open={open}
        title="Delete product line?"
        description={`"${productLineName}" and all its data (agent, triggers, updates) will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
