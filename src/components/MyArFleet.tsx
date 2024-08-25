import { useCallback, useState } from "react";
import { useDropzone } from 'react-dropzone';
import { CloudUpload, File, Folder, Upload, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  file: File;
  path: string;
}

const UPLOAD_ENDPOINT = 'http://localhost:3000/upload';

export default function MyArFleet() {
  const [uploadedItems, setUploadedItems] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file, file.webkitRelativePath || file.name);
    });

    try {
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      console.log('Upload successful:', result);
      // Handle successful upload (e.g., show success message)
    } catch (error) {
      console.error('Upload error:', error);
      // Handle error (e.g., show error message)
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const items: FileItem[] = acceptedFiles.map(file => ({
      file,
      path: file.webkitRelativePath || file.name
    }));

    setUploadedItems(prevItems => [...prevItems, ...items]);
    await uploadFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
  });

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) onDrop(Array.from(files));
    };
    input.click();
  }, [onDrop]);

  const handleDirSelect = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = await getFilesFromDirectory(dirHandle);
      onDrop(files);
    } catch (error) {
      console.error("Error selecting directory:", error);
    }
  }, [onDrop]);

  return (
    <main className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-bold md:text-3xl">My ArFleet</h1>
      </div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 p-8",
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25"
        )}
      >
        <input {...getInputProps()} />
        <CloudUpload 
          className={cn(
            "h-24 w-24 transition-colors duration-300 mb-6",
            isDragActive ? "text-primary" : "text-muted-foreground"
          )} 
        />
        <h3 className="text-2xl font-bold tracking-tight mb-2">
          Upload to ArFleet
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {isDragActive
            ? "Drop the files here"
            : "Drag and drop your files or folders here"}
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleFileSelect}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-md"
          >
            <Upload className="mr-2 h-5 w-5" />
            Select Files
          </button>
          <button
            onClick={handleDirSelect}
            className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors shadow-md"
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            Select Folder
          </button>
        </div>
      </div>
      {isUploading && <p>Uploading...</p>}
      {uploadedItems.length > 0 && (
        <>
          <div className="h-px bg-border my-6" /> {/* Separator */}
          <div className="bg-card rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-semibold mb-4">Uploaded Items</h3>
            <ul className="space-y-2">
              {uploadedItems.map((item, index) => (
                <li key={index} className="flex items-center p-2 rounded-lg hover:bg-accent transition-colors">
                  {item.path.includes('/') ? <Folder className="mr-3 text-blue-500" size={20} /> : <File className="mr-3 text-green-500" size={20} />}
                  <span className="text-sm">{item.path}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}

async function getFilesFromDirectory(dirHandle: FileSystemDirectoryHandle, path = ''): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `${path}${file.name}`
      });
      files.push(file);
    } else if (entry.kind === 'directory') {
      files.push(...await getFilesFromDirectory(entry, `${path}${entry.name}/`));
    }
  }
  return files;
}