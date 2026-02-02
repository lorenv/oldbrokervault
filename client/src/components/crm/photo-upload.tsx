import { useState, useRef } from "react";
import { Camera, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoChange: (photoUrl: string | null) => Promise<void>;
  placeholder?: React.ReactNode;
  shape?: "circle" | "rounded";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PhotoUpload({
  currentPhotoUrl,
  onPhotoChange,
  placeholder,
  shape = "circle",
  size = "md",
  className = "",
}: PhotoUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12 sm:w-14 sm:h-14",
    lg: "w-16 h-16 sm:w-20 sm:h-20",
  };

  const shapeClasses = {
    circle: "rounded-full",
    rounded: "rounded-lg",
  };

  const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      let dataUrl = await compressImage(file, 400, 0.8);

      // If still too large, compress more
      if (dataUrl.length > 500 * 1024) {
        dataUrl = await compressImage(file, 300, 0.6);
      }

      await onPhotoChange(dataUrl);
      toast({
        title: "Photo updated",
        description: "The photo has been saved.",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process the image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);
    try {
      await onPhotoChange(null);
      toast({
        title: "Photo removed",
        description: "The photo has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove the photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {currentPhotoUrl ? (
        <>
          <img
            src={currentPhotoUrl}
            alt="Photo"
            className={`${sizeClasses[size]} ${shapeClasses[shape]} object-cover`}
          />
          {isHovered && !isUploading && (
            <div
              className={`absolute inset-0 ${shapeClasses[shape]} bg-black/50 flex items-center justify-center gap-1`}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={handleRemovePhoto}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div
          className={`${sizeClasses[size]} ${shapeClasses[shape]} flex items-center justify-center cursor-pointer transition-colors ${
            isHovered ? "bg-gray-200" : "bg-gray-100"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          {placeholder || <Camera className="h-5 w-5 text-gray-400" />}
        </div>
      )}

      {isUploading && (
        <div
          className={`absolute inset-0 ${shapeClasses[shape]} bg-black/50 flex items-center justify-center`}
        >
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
