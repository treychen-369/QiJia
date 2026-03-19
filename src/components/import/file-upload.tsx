'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress as UIProgress } from '@/components/ui/progress'
import { Alert as UIAlert, AlertDescription as UIAlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  isUploading?: boolean
  uploadProgress?: number
  error?: string
  className?: string
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  isUploading = false,
  uploadProgress = 0,
  error,
  className
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  })

  const handleRemoveFile = () => {
    setSelectedFile(null)
    onFileRemove()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn('space-y-4', className)}>
      {!selectedFile ? (
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50',
                isUploading && 'cursor-not-allowed opacity-50'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {isDragActive ? '释放文件以上传' : '选择或拖拽Excel文件'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    支持 .xlsx, .xls, .csv 格式，最大 10MB
                  </p>
                </div>
                <Button variant="outline" disabled={isUploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  选择文件
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </p>
                {isUploading && (
                  <div className="mt-2 space-y-1">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      上传中... {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 文件拒绝错误 */}
      {fileRejections.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {fileRejections[0]?.errors[0]?.message || '文件上传错误'}
          </AlertDescription>
        </Alert>
      )}

      {/* 上传错误 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 文件要求说明 */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">文件要求</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 支持Excel格式：.xlsx, .xls</li>
            <li>• 支持CSV格式：.csv</li>
            <li>• 文件大小不超过10MB</li>
            <li>• 请确保数据格式与模板一致</li>
            <li>• 建议先备份原始文件</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

// Progress组件（如果还没有的话）
function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('w-full bg-secondary rounded-full h-2', className)}>
      <div
        className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// Alert组件（如果还没有的话）
function Alert({ 
  variant = 'default', 
  className, 
  children 
}: { 
  variant?: 'default' | 'destructive'
  className?: string
  children: React.ReactNode 
}) {
  return (
    <div className={cn(
      'relative w-full rounded-lg border p-4',
      variant === 'destructive' 
        ? 'border-destructive/50 text-destructive dark:border-destructive' 
        : 'border-border',
      className
    )}>
      {children}
    </div>
  )
}

function AlertDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm [&_p]:leading-relaxed">
      {children}
    </div>
  )
}