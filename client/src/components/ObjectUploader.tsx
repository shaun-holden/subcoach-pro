import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
// Uppy plugins for enhanced upload functionality
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
// Uppy styles for UI components
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  uploadMethods?: ('modal' | 'dragdrop' | 'browse')[];
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  onProgress?: (progress: number) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A versatile file upload component supporting multiple upload methods including
 * modal interface, drag-and-drop, and direct file browser.
 * 
 * Features:
 * - Multiple upload methods: modal, drag-and-drop, file browser
 * - File type restrictions and validation
 * - Real-time upload progress tracking
 * - Customizable UI and styling
 * - Secure presigned URL uploads
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.allowedFileTypes - Array of allowed MIME types (default: all)
 * @param props.uploadMethods - Upload methods to enable (default: ['modal'])
 * @param props.onGetUploadParameters - Function to get upload parameters
 * @param props.onComplete - Callback when upload completes
 * @param props.onProgress - Callback for upload progress updates
 * @param props.buttonClassName - CSS class for the trigger button
 * @param props.children - Content for the trigger button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  allowedFileTypes,
  uploadMethods = ['modal'],
  onGetUploadParameters,
  onComplete,
  onProgress,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [uppy] = useState(() => {
    const restrictions: any = {
      maxNumberOfFiles,
      maxFileSize,
    };
    
    if (allowedFileTypes) {
      restrictions.allowedFileTypes = allowedFileTypes;
    }

    const uppyInstance = new Uppy({
      restrictions,
      autoProceed: false, // Always require manual triggering to prevent accidental uploads
      id: `uppy-${Math.random().toString(36).substr(2, 9)}`, // Unique ID to prevent conflicts
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("upload-progress", (file, progress) => {
        if (progress.bytesTotal) {
          const progressPercent = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
          setUploadProgress(progressPercent);
          onProgress?.(progressPercent);
        }
      })
      .on("upload", () => {
        setIsUploading(true);
        setUploadProgress(0);
      })
      .on("complete", (result) => {
        setIsUploading(false);
        setUploadProgress(0);
        onComplete?.(result);
        setShowModal(false);
      })
      .on("error", () => {
        setIsUploading(false);
        setUploadProgress(0);
      });

    return uppyInstance;
  });

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      } catch (err) {
        console.error('Error adding file:', err);
      }
    });
    
    if (uploadMethods.includes('browse') && !uploadMethods.includes('modal')) {
      uppy.upload();
    }
  };

  return (
    <div className="space-y-4">
      {/* Modal Upload Button */}
      {uploadMethods.includes('modal') && (
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
          }} 
          className={buttonClassName}
          disabled={isUploading}
          type="button"
        >
          {children}
        </Button>
      )}

      {/* Drag and Drop Area */}
      {uploadMethods.includes('dragdrop') && (
        <div 
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center transition-colors hover:border-gray-400 dark:hover:border-gray-500"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-950');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-950');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-950');
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
              try {
                uppy.addFile({
                  name: file.name,
                  type: file.type,
                  data: file,
                });
              } catch (err) {
                console.error('Error adding file:', err);
              }
            });
            
            uppy.upload();
          }}
        >
          <div className="space-y-2">
            <div className="text-gray-600 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Drop files here
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              or click to browse files
            </div>
            {allowedFileTypes && (
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Supported: {allowedFileTypes.join(', ')}
              </div>
            )}
          </div>
          
          <input
            type="file"
            multiple={maxNumberOfFiles > 1}
            accept={allowedFileTypes?.join(',')}
            onChange={handleFileInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      )}

      {/* File Browser Input */}
      {uploadMethods.includes('browse') && !uploadMethods.includes('dragdrop') && (
        <div>
          <input
            type="file"
            multiple={maxNumberOfFiles > 1}
            accept={allowedFileTypes?.join(',')}
            onChange={handleFileInputChange}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800"
            disabled={isUploading}
          />
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Modal */}
      {uploadMethods.includes('modal') && showModal && (
        <DashboardModal
          uppy={uppy}
          open={showModal}
          onRequestClose={() => setShowModal(false)}
          proudlyDisplayPoweredByUppy={false}
          closeModalOnClickOutside={true}
          closeAfterFinish={true}
        />
      )}
    </div>
  );
}