"use client";

import { useState, useEffect, use } from "react";

export default function ServerDetailPage({ params, searchParams }) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const pathParam = resolvedSearchParams?.path;
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [fileType, setFileType] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadXhr, setUploadXhr] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [useChunkedUpload, setUseChunkedUpload] = useState(true);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [concurrentChunks, setConcurrentChunks] = useState(3);

  useEffect(() => {
    if (pathParam) {
      fetchFolders();
    }
  }, [pathParam]);

  // Добавляем обработчик Ctrl+S для сохранения
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (selectedFile && isSharedFile(selectedFile) && fileType === 'text') {
          saveFileContent();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedFile, editContent]);

  // Предотвращаем стандартное поведение drag & drop для всей страницы
  useEffect(() => {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handlePageDragOver = (e) => {
      preventDefaults(e);
      setIsDragOver(true);
    };

    const handlePageDragLeave = (e) => {
      preventDefaults(e);
      // Проверяем, действительно ли мы покинули страницу
      if (!e.relatedTarget) {
        setIsDragOver(false);
      }
    };

    const handlePageDrop = (e) => {
      preventDefaults(e);
      setIsDragOver(false);
    };

    // Добавляем обработчики на document
    document.addEventListener('dragenter', preventDefaults);
    document.addEventListener('dragover', handlePageDragOver);
    document.addEventListener('dragleave', handlePageDragLeave);
    document.addEventListener('drop', handlePageDrop);

    return () => {
      document.removeEventListener('dragenter', preventDefaults);
      document.removeEventListener('dragover', handlePageDragOver);
      document.removeEventListener('dragleave', handlePageDragLeave);
      document.removeEventListener('drop', handlePageDrop);
    };
  }, []);

  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching folders for path:', pathParam);
      const res = await fetch(`/api/v1/server/${resolvedParams.id}/browse?path=${pathParam}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Fetched files and folders:', data);
      setFolders(data.dirs || []);
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching folders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderName) => {
    const newPath = pathParam.endsWith('/') ? `${pathParam}${folderName}` : `${pathParam}/${folderName}`;
    window.location.href = `/servers/${resolvedParams.id}?path=${encodeURIComponent(newPath)}`;
  };

  // Определяем поддерживает ли файл streaming
  const supportsStreaming = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const streamingFormats = [
      // Видео форматы с хорошей поддержкой streaming
      'mp4', 'webm', 'mov', 'avi', 'mkv',
      // Аудио форматы
      'mp3', 'wav', 'ogg', 'm4a', 'flac'
    ];
    return streamingFormats.includes(extension);
  };

  const handleFileClick = async (fileName) => {
    const filePath = pathParam.endsWith('/') ? `${pathParam}${fileName}` : `${pathParam}/${fileName}`;
    setSelectedFile(fileName);
    setFileLoading(true);
    setFileError(null);
    setFileType('text'); // По умолчанию текст
    
    try {
      console.log('Fetching file content for:', filePath);
      
      // Для streaming файлов используем специальную логику
      if (supportsStreaming(fileName)) {
        const res = await fetch(`/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(filePath)}`, {
          method: 'HEAD',
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('Content-Type') || '';
        const fileSize = parseInt(res.headers.get('Content-Length') || '0');
        
        console.log('Content-Type:', contentType, 'Size:', fileSize);
        
        // Создаем streaming URL для больших медиа файлов
        const STREAMING_THRESHOLD = 5 * 1024 * 1024; // 10MB
        const useStreaming = fileSize > STREAMING_THRESHOLD;
        
        if (contentType.startsWith('video/') && useStreaming) {
          setFileType('video-stream');
          // Используем прямой URL с поддержкой Range requests для streaming
          const streamingUrl = `/api/v1/server/${resolvedParams.id}/file/stream?path=${encodeURIComponent(filePath)}`;
          setFileContent(streamingUrl);
        } else if (contentType.startsWith('audio/') && useStreaming) {
          setFileType('audio-stream');
          const streamingUrl = `/api/v1/server/${resolvedParams.id}/file/stream?path=${encodeURIComponent(filePath)}`;
          setFileContent(streamingUrl);
        } else {
          // Для маленьких файлов загружаем полностью
          const res = await fetch(`/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(filePath)}`, {
            cache: 'no-store',
          });
          
          if (contentType.startsWith('video/')) {
            setFileType('video');
            const blob = await res.blob();
            const videoUrl = URL.createObjectURL(blob);
            setFileContent(videoUrl);
          } else if (contentType.startsWith('audio/')) {
            setFileType('audio');
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            setFileContent(audioUrl);
          }
        }
      } else {
        // Для не-streaming файлов используем обычную логику
        const res = await fetch(`/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(filePath)}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('Content-Type') || '';
        console.log('Content-Type:', contentType);
        
        // Определяем тип файла по Content-Type
        if (contentType.startsWith('image/')) {
          setFileType('image');
          const blob = await res.blob();
          const imageUrl = URL.createObjectURL(blob);
          setFileContent(imageUrl);
        } else if (contentType.includes('application/pdf')) {
          setFileType('pdf');
          const blob = await res.blob();
          const pdfUrl = URL.createObjectURL(blob);
          setFileContent(pdfUrl);
        } else if (contentType.startsWith('video/')) {
          setFileType('video');
          const blob = await res.blob();
          const videoUrl = URL.createObjectURL(blob);
          setFileContent(videoUrl);
        } else if (contentType.startsWith('audio/')) {
          setFileType('audio');
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          setFileContent(audioUrl);
        } else if (contentType.includes('application/') && !contentType.includes('json') && !contentType.includes('xml')) {
          // Бинарные файлы - попробуем отобразить как текст
          setFileType('text');
          const content = await res.text();
          setFileContent(content);
        } else {
          // Текстовые файлы
          setFileType('text');
          const content = await res.text();
          setFileContent(content);
          
          // Автоматически активируем режим редактирования для .shared файлов
          if (isSharedFile(fileName)) {
            setIsEditing(true);
            setEditContent(content);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setFileError(err.message);
    } finally {
      setFileLoading(false);
    }
  };

  const closeFileViewer = () => {
    // Освобождаем blob URL если он был создан (только для не-streaming контента)
    if (fileContent && (fileType === 'image' || fileType === 'pdf' || fileType === 'video' || fileType === 'audio')) {
      URL.revokeObjectURL(fileContent);
    }
    // Для streaming контента URL не нужно освобождать, так как это прямая ссылка на API
    setSelectedFile(null);
    setFileContent('');
    setFileError(null);
    setFileType('text');
    setIsEditing(false);
    setEditContent('');
    setSaving(false);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadingFiles(files.map(f => f.name));
    setCurrentUploadIndex(0);

    try {
      const uploadPath = pathParam.endsWith('/') ? pathParam : `${pathParam}/`;
      
      // Загружаем файлы по очереди используя гибридный подход
      for (let i = 0; i < files.length; i++) {
        setCurrentUploadIndex(i);
        const file = files[i];
        
        // Используем прямую загрузку для файлов меньше 5MB, chunked для больших
        const useDirectUpload = file.size < 1024 * 1024 * 5; // 5MB
        
        if (useDirectUpload) {
          // Прямая загрузка для маленьких файлов
          await handleDirectFileUpload(file, uploadPath, i, files.length);
        } else {
          // Chunked upload для больших файлов
          await handleChunkedFileUpload(file, uploadPath, i, files.length);
        }
      }

      // Показываем 100% на короткое время
      setUploadProgress(100);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Обновляем содержимое директории
      await fetchFolders();
      
      // Сбрасываем input
      event.target.value = '';
      
    } catch (err) {
      console.error('Error uploading file:', err);
      
      // Если загрузка была отменена пользователем, не показываем ошибку
      if (err.message === 'Upload cancelled') {
        return;
      }
      
      // Более красивое уведомление об ошибке для мобильных
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        // Для мобильных - простой alert
        alert(`❌ Failed to upload files:\n${err.message}`);
      } else {
        // Для десктопа - confirm с возможностью повтора
        if (window.confirm(`❌ Failed to upload files: ${err.message}\n\nWould you like to try again?`)) {
          // Пользователь может попробовать снова
          document.getElementById('file-upload').click();
        }
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadXhr(null);
      setUploadingFiles([]);
      setCurrentUploadIndex(0);
      setCurrentChunk(0);
      setTotalChunks(0);
      setConcurrentChunks(3);
    }
  };

  const cancelUpload = () => {
    if (uploadXhr) {
      uploadXhr.abort();
      setUploadXhr(null);
    }
    
    // Сбрасываем все состояния загрузки
    setUploading(false);
    setUploadProgress(0);
    setUploadingFiles([]);
    setCurrentUploadIndex(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setConcurrentChunks(3);
  };

  // Определяем размер chunk'а и количество параллельных загрузок в зависимости от устройства и соединения
  const getUploadConfig = () => {
    const CHUNK_SIZE = {
      mobile: 2 * 1024 * 1024,       // 2MB для мобильных (было 512KB)
      desktop: 5 * 1024 * 1024,      // 5MB для десктопа (было 1MB)
      slow: 1024 * 1024,             // 1MB для медленного интернета (было 256KB)
      fast: 10 * 1024 * 1024         // 10MB для быстрого интернета (было 2MB)
    };

    const CONCURRENT_CHUNKS = {
      mobile: 3,               // 2 параллельных чанка для мобильных
      desktop: 3,              // 3 для десктопа
      slow: 1,                 // 1 для медленного интернета
      fast: 4                  // 4 для быстрого интернета
    };

    const isMobile = window.innerWidth < 768;
    const connection = navigator.connection;
    
    let config = { chunkSize: CHUNK_SIZE.desktop, concurrent: CONCURRENT_CHUNKS.desktop };
    
    if (isMobile) {
      config = { chunkSize: CHUNK_SIZE.mobile, concurrent: CONCURRENT_CHUNKS.mobile };
    } else if (connection) {
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        config = { chunkSize: CHUNK_SIZE.slow, concurrent: CONCURRENT_CHUNKS.slow };
      } else if (connection.effectiveType === '4g') {
        config = { chunkSize: CHUNK_SIZE.fast, concurrent: CONCURRENT_CHUNKS.fast };
      }
    }
    
    return config;
  };

  // Функция для загрузки одного чанка
  const uploadSingleChunk = async (file, chunkIndex, chunkSize, uploadId, totalChunks) => {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const chunkFormData = new FormData();
    chunkFormData.append('chunk', chunk);
    chunkFormData.append('uploadId', uploadId);
    chunkFormData.append('chunkIndex', chunkIndex.toString());
    chunkFormData.append('totalChunks', totalChunks.toString());

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed: Network error`));
      };
      
      xhr.ontimeout = () => {
        reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed: Request timeout`));
      };
      
      xhr.onabort = () => {
        reject(new Error('Upload cancelled'));
      };

      xhr.open('POST', `/api/v1/server/${resolvedParams.id}/file/chunk`);
      xhr.timeout = 300000; // 5 минут на chunk
      xhr.send(chunkFormData);
    });
  };

  // Прямая загрузка маленьких файлов без chunking
  const handleDirectFileUpload = async (file, uploadPath, fileIndex, totalFiles) => {
    // Сбрасываем chunked индикаторы для прямой загрузки
    setTotalChunks(1);
    setCurrentChunk(1);
    setConcurrentChunks(1);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const fullPath = `${uploadPath}${file.name}`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      setUploadXhr(xhr);
      
      // Отслеживание прогресса загрузки
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const fileProgress = Math.round((event.loaded / event.total) * 100);
          const totalProgress = Math.round(((fileIndex + (fileProgress / 100)) / totalFiles) * 100);
          setUploadProgress(totalProgress);
        }
      });
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed for ${file.name}: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error(`Upload failed for ${file.name}: Network error`));
      };
      
      xhr.ontimeout = () => {
        reject(new Error(`Upload failed for ${file.name}: Request timeout`));
      };
      
      xhr.onabort = () => {
        reject(new Error('Upload cancelled'));
      };
      
      xhr.open('POST', `/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(fullPath)}`);
      xhr.timeout = 1800000; // 30 минут таймаут
      xhr.send(formData);
    });
  };

  // Chunked загрузка файла
  // Chunked загрузка файла с параллельными чанками
  const handleChunkedFileUpload = async (file, uploadPath, fileIndex, totalFiles) => {
    const config = getUploadConfig();
    const totalChunks = Math.ceil(file.size / config.chunkSize);
    setTotalChunks(totalChunks);
    setConcurrentChunks(config.concurrent);
    
    try {
      // 1. Инициализация загрузки
      const initData = {
        fileName: file.name,
        fileSize: file.size,
        totalChunks: totalChunks,
        path: uploadPath
      };

      const initResponse = await fetch(`/api/v1/server/${resolvedParams.id}/file/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initData)
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize upload: ${initResponse.status} ${initResponse.statusText}`);
      }

      const initResult = await initResponse.json();
      const uploadId = initResult.uploadId;

      // 2. Параллельная загрузка по частям
      let completedChunks = 0;
      
      for (let i = 0; i < totalChunks; i += config.concurrent) {
        // Создаем батч чанков для параллельной загрузки
        const chunkBatch = [];
        
        for (let j = 0; j < config.concurrent && (i + j) < totalChunks; j++) {
          const chunkIndex = i + j;
          chunkBatch.push(
            uploadSingleChunk(file, chunkIndex, config.chunkSize, uploadId, totalChunks)
              .then(() => {
                completedChunks++;
                setCurrentChunk(completedChunks);
                
                // Обновляем прогресс
                const fileProgress = (completedChunks / totalChunks) * 100;
                const totalProgress = ((fileIndex + (fileProgress / 100)) / totalFiles) * 100;
                setUploadProgress(Math.round(totalProgress));
              })
          );
        }
        
        // Ждем завершения всех чанков в батче
        await Promise.all(chunkBatch);
      }

      return true;
    } catch (error) {
      console.error('Chunked upload error:', error);
      throw error;
    }
  };

  // Обработчики drag & drop для контейнера
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Создаем синтетический event объект для handleFileUpload
      const syntheticEvent = {
        target: {
          files: files,
          value: ''
        }
      };
      handleFileUpload(syntheticEvent);
    }
  };

  // Определяем нужно ли использовать chunked скачивание
  const shouldUseChunkedDownload = (fileName, fileSize) => {
    const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
    
    // Всегда используем chunked для больших файлов
    if (fileSize && fileSize > LARGE_FILE_THRESHOLD) {
      return true;
    }
    
    // Для медленного соединения используем chunked для файлов > 10MB
    const connection = navigator.connection;
    if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      return fileSize && fileSize > 10 * 1024 * 1024; // 10MB
    }
    
    return false;
  };

  // Функция скачивания файла с поддержкой chunked загрузки
  const handleFileDownload = async (fileName, fileSize = null) => {
    try {
      const filePath = pathParam.endsWith('/') ? `${pathParam}${fileName}` : `${pathParam}/${fileName}`;
      
      // Определяем нужно ли использовать chunked скачивание
      const useChunked = shouldUseChunkedDownload(fileName, fileSize);
      
      if (useChunked) {
        await handleChunkedFileDownload(fileName, filePath, fileSize);
      } else {
        await handleDirectFileDownload(fileName, filePath);
      }
      
    } catch (err) {
      console.error('Error downloading file:', err);
      
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        alert(`❌ Failed to download file:\n${err.message}`);
      } else {
        if (window.confirm(`❌ Failed to download file: ${err.message}\n\nWould you like to try again?`)) {
          handleFileDownload(fileName, fileSize);
        }
      }
    }
  };

  // Прямое скачивание для маленьких файлов
  const handleDirectFileDownload = async (fileName, filePath) => {
    const response = await fetch(`/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(filePath)}&mode=download`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  // Chunked скачивание для больших файлов с прогрессом
  const handleChunkedFileDownload = async (fileName, filePath, fileSize) => {
    // Показываем прогресс скачивания
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1000;
      background: white; border-radius: 8px; padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 250px;
    `;
    progressContainer.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">📥 Downloading ${fileName}</div>
      <div style="background: #f0f0f0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div id="download-progress" style="background: #4ade80; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 4px;">
        <span id="download-status">Starting download...</span>
      </div>
    `;
    document.body.appendChild(progressContainer);

    try {
      // Получаем информацию о файле для определения размера
      let totalSize = fileSize;
      if (!totalSize) {
        const headResponse = await fetch(`/api/v1/server/${resolvedParams.id}/file/info?path=${encodeURIComponent(filePath)}`, {
          method: 'HEAD',
        });
        totalSize = parseInt(headResponse.headers.get('content-length') || '0');
      }

      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks для скачивания
      const chunks = [];
      let downloadedBytes = 0;

      // Скачиваем файл по частям
      for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
        
        const response = await fetch(`/api/v1/server/${resolvedParams.id}/file/download?path=${encodeURIComponent(filePath)}&mode=download`, {
          method: 'GET',
          headers: {
            'Range': `bytes=${start}-${end}`
          },
          cache: 'no-store',
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Chunk download failed: ${response.status} ${response.statusText}`);
        }

        const chunk = await response.arrayBuffer();
        chunks.push(chunk);
        downloadedBytes += chunk.byteLength;

        // Обновляем прогресс
        const progress = Math.round((downloadedBytes / totalSize) * 100);
        const progressBar = document.getElementById('download-progress');
        const statusText = document.getElementById('download-status');
        
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (statusText) {
          const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
          const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
          statusText.textContent = `${downloadedMB}MB / ${totalMB}MB (${progress}%)`;
        }
      }

      // Создаем blob из всех частей
      const blob = new Blob(chunks);
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Показываем завершение
      if (document.getElementById('download-status')) {
        document.getElementById('download-status').textContent = '✅ Download completed!';
      }
      
      // Убираем прогресс через 2 секунды
      setTimeout(() => {
        if (progressContainer.parentNode) {
          progressContainer.parentNode.removeChild(progressContainer);
        }
      }, 2000);

    } catch (error) {
      // Убираем прогресс при ошибке
      if (progressContainer.parentNode) {
        progressContainer.parentNode.removeChild(progressContainer);
      }
      throw error;
    }
  };

  const isSharedFile = (fileName) => {
    return fileName.toLowerCase().endsWith('.shared');
  };

  const startEditing = () => {
    setIsEditing(true);
    setEditContent(fileContent);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const saveFileContent = async () => {
    if (!editContent && editContent !== '') return; // Не сохраняем если нет контента для редактирования
    
    setSaving(true);
    
    try {
      const filePath = pathParam.endsWith('/') ? `${pathParam}${selectedFile}` : `${pathParam}/${selectedFile}`;
      
      const response = await fetch(`/api/v1/server/${resolvedParams.id}/file?path=${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: editContent,
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
      }

      // Обновляем контент файла
      setFileContent(editContent);

      // Показываем уведомление об успешном сохранении
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        alert('✅ File saved successfully!');
      } else {
        // Для десктопа можно добавить более красивое уведомление
        console.log('File saved successfully');
      }

    } catch (err) {
      console.error('Error saving file:', err);
      
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        alert(`❌ Failed to save file:\n${err.message}`);
      } else {
        if (window.confirm(`❌ Failed to save file: ${err.message}\n\nWould you like to try again?`)) {
          // Пользователь может попробовать снова
          saveFileContent();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const getBreadcrumbs = () => {
    if (!pathParam || pathParam === '/') return [];
    
    const parts = pathParam.split('/').filter(Boolean);
    const breadcrumbs = [];
    
    for (let i = 0; i < parts.length; i++) {
      const path = '/' + parts.slice(0, i + 1).join('/');
      breadcrumbs.push({
        name: parts[i],
        path: path
      });
    }
    
    return breadcrumbs;
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Изображения
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      return '🖼️';
    }
    // Видео
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
      return '🎥';
    }
    // Аудио
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension)) {
      return '🎵';
    }
    // PDF
    if (extension === 'pdf') {
      return '📄';
    }
    // Документы
    if (['doc', 'docx', 'odt'].includes(extension)) {
      return '📝';
    }
    // Таблицы
    if (['xls', 'xlsx', 'ods'].includes(extension)) {
      return '📊';
    }
    // Презентации
    if (['ppt', 'pptx', 'odp'].includes(extension)) {
      return '📽️';
    }
    // Архивы
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      return '📦';
    }
    // Код
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs'].includes(extension)) {
      return '💻';
    }
    // Конфигурация
    if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg'].includes(extension)) {
      return '⚙️';
    }
    // Текст
    if (['txt', 'md', 'readme'].includes(extension)) {
      return '📝';
    }
    // Shared файлы
    if (extension === 'shared') {
      return '🗿';
    }
    
    // По умолчанию
    return '📄';
  };
  
  // Если нет pathParam, показываем приветствие
  if (!pathParam) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <main className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-950 px-6 py-8 text-center">
              <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white">Server {resolvedParams.id}</h1>
              <p className="text-slate-300 text-sm mt-1">You're connected and ready to browse</p>
            </div>

            <div className="p-6">
              <a
                href={`/servers/${resolvedParams.id}?path=/`}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 active:bg-slate-700 transition-colors font-medium text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-7l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Browse root directory
              </a>

              <a
                href="/"
                className="flex items-center justify-center gap-1.5 w-full mt-3 px-4 py-2.5 text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to server list
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Если есть ошибка загрузки
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <main className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Failed to load contents</h3>
            <p className="text-slate-500 text-sm mb-5 break-words">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={fetchFolders}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                Try again
              </button>
              <a
                href={`/servers/${resolvedParams.id}`}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Go back
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-7l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">
                  Server {resolvedParams.id}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 truncate">File browser</p>
              </div>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Servers</span>
            </a>
          </div>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm overflow-x-auto bg-white border border-slate-200 rounded-xl px-3 py-2.5" aria-label="Breadcrumb">
            <a
              href={`/servers/${resolvedParams.id}?path=/`}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
              <span>root</span>
            </a>

            {getBreadcrumbs().map((crumb, index) => (
              <span key={index} className="inline-flex items-center gap-1">
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                {index === getBreadcrumbs().length - 1 ? (
                  <span className="text-slate-900 font-semibold whitespace-nowrap truncate max-w-[10rem]">
                    {crumb.name}
                  </span>
                ) : (
                  <a
                    href={`/servers/${resolvedParams.id}?path=${encodeURIComponent(crumb.path)}`}
                    className="text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap truncate max-w-[8rem]"
                  >
                    {crumb.name}
                  </a>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div 
            className="p-4 sm:p-5 border-b border-slate-100"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    Contents
                  </h2>
                  {loading && (
                    <svg className="animate-spin h-4 w-4 text-slate-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {loading ? 'Loading…' : `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'} · ${files.length} ${files.length === 1 ? 'file' : 'files'}`}
                </p>
              </div>
              
              {/* Upload button */}
              <div className="w-full sm:w-auto">
                <input
                  type="file"
                  id="file-upload"
                  className="sr-only"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  multiple
                />
                
                {!uploading ? (
                  <button
                    onClick={() => document.getElementById('file-upload').click()}
                    disabled={uploading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Upload files
                  </button>
                ) : (
                  <button
                    onClick={cancelUpload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                )}
              </div>
            </div>
            
            {/* Hint */}
            {!uploading && (
              <p className="text-xs text-slate-400 mt-3 hidden sm:flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                Drag &amp; drop files here, or select multiple at once. Large files upload in parallel chunks automatically.
              </p>
            )}
            
            {/* Upload progress */}
            {uploading && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center min-w-0">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-700 border-t-transparent mr-2.5 flex-shrink-0"></div>
                    <div className="text-sm min-w-0">
                      <span className="font-medium text-slate-800">
                        Uploading {uploadingFiles.length > 1 ? `${currentUploadIndex + 1} of ${uploadingFiles.length}` : 'file'}…
                      </span>
                      {uploadingFiles.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                          {uploadingFiles[currentUploadIndex]}
                          {totalChunks > 1 && (
                            <span className="ml-1.5 text-slate-500">
                              · {currentChunk}/{totalChunks} chunks
                            </span>
                          )}
                          {totalChunks === 1 && (
                            <span className="ml-1.5 text-emerald-600">· direct</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums flex-shrink-0">
                    {uploadProgress}%
                  </span>
                </div>
                
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-slate-900 h-2 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-transparent mx-auto"></div>
                <p className="text-slate-500 mt-4 text-sm">Loading contents…</p>
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">This folder is empty</h3>
                <p className="text-slate-500 text-sm">Upload files or drag them here to get started</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Folders */}
                {folders.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                      Folders
                    </h3>
                    <div className="space-y-0.5">
                      {folders.map((folder, index) => (
                        <button
                          key={`folder-${index}`}
                          onClick={() => handleFolderClick(folder)}
                          className="flex items-center w-full p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group text-left"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center mr-3 flex-shrink-0">
                            <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                            </svg>
                          </div>
                          <span className="text-sm text-slate-800 font-medium flex-1 truncate group-hover:text-slate-900">
                            {folder}
                          </span>
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                {files.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                      Files
                    </h3>
                    <div className="space-y-0.5">
                      {files.map((file, index) => (
                        <div 
                          key={`file-${index}`}
                          className="flex items-center p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <button 
                            className="flex items-center flex-1 min-w-0 text-left"
                            onClick={() => handleFileClick(file)}
                          >
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center mr-3 flex-shrink-0 text-base">
                              {getFileIcon(file)}
                            </div>
                            <span className="text-sm text-slate-800 font-medium flex-1 truncate group-hover:text-slate-900">
                              {file}
                            </span>
                          </button>
                          
                          {/* Download button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileDownload(file);
                            }}
                            className="ml-2 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100"
                            title="Download file"
                          >
                            <svg className="w-4.5 h-4.5" style={{ width: '1.125rem', height: '1.125rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drag & Drop Overlay */}
        {isDragOver && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <div className="text-center p-8 bg-white rounded-2xl shadow-2xl max-w-sm w-full border-2 border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-900 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Drop files to upload
              </h3>
              <p className="text-slate-500 text-sm">
                Release to add them to this folder
              </p>
            </div>
          </div>
        )}

        {/* Полноэкранный просмотр файлов */}
        {selectedFile && (
          <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
            {/* Заголовок с кнопками управления */}
            <div className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm border-b border-white/10 px-3 sm:px-4 py-3 z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center text-white min-w-0">
                  <span className="text-base mr-2 flex-shrink-0">{getFileIcon(selectedFile)}</span>
                  <h3 className="text-sm sm:text-base font-medium truncate">
                    {selectedFile}
                  </h3>
                  {isSharedFile(selectedFile) && fileType === 'text' && (
                    <span className="ml-2.5 px-2 py-0.5 bg-white/10 text-slate-300 text-xs rounded-md whitespace-nowrap hidden sm:inline">
                      Editing · Ctrl+S to save
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Кнопка сохранения для .shared файлов */}
                  {isSharedFile(selectedFile) && fileType === 'text' && !fileLoading && !fileError && (
                    <button
                      onClick={saveFileContent}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-white text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save'}</span>
                    </button>
                  )}
                  
                  {/* Кнопка закрытия */}
                  <button
                    onClick={closeFileViewer}
                    className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                    title="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Контент файла */}
            <div className="flex-1 flex items-stretch justify-center pt-16 sm:pt-20 p-2 sm:p-4 min-h-0">
              {fileLoading ? (
                <div className="text-center flex items-center justify-center w-full">
                  <div>
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white mx-auto"></div>
                    <p className="text-white/80 mt-4 text-sm">Loading…</p>
                  </div>
                </div>
              ) : fileError ? (
                <div className="text-center px-4 flex items-center justify-center w-full">
                  <div>
                    <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h4 className="text-base font-semibold text-white mb-1">Failed to load file</h4>
                    <p className="text-white/60 text-sm mb-5">{fileError}</p>
                    <button
                      onClick={() => handleFileClick(selectedFile)}
                      className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm font-medium"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {fileType === 'image' ? (
                    <img 
                      src={fileContent} 
                      alt={selectedFile}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : fileType === 'pdf' ? (
                    <div className="w-full h-full flex flex-col">
                      {/* PDF для мобильных устройств - показываем кнопку загрузки */}
                      <div className="flex-1 flex items-center justify-center bg-slate-800/50 rounded-xl mx-2 sm:mx-0">
                        {/* Для больших экранов показываем iframe */}
                        <div className="hidden lg:block w-full h-full p-4">
                          <iframe
                            src={fileContent}
                            className="w-full h-full border-0 rounded-lg"
                            title={selectedFile}
                          />
                        </div>
                        
                        {/* Для мобильных и планшетов - информация и кнопки */}
                        <div className="lg:hidden text-center p-6 max-w-sm">
                          <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          </div>
                          <h3 className="text-white text-lg font-semibold mb-1">
                            {selectedFile}
                          </h3>
                          <p className="text-white/50 text-sm mb-5">PDF Document</p>
                          
                          {/* Кнопки действий */}
                          <div className="space-y-2.5">
                            <a
                              href={fileContent}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full bg-white text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              Open in new tab
                            </a>
                            <button
                              onClick={() => {
                                if (navigator.share && navigator.canShare) {
                                  navigator.share({
                                    title: selectedFile,
                                    url: fileContent
                                  });
                                } else {
                                  navigator.clipboard.writeText(fileContent);
                                  alert('Link copied to clipboard');
                                }
                              }}
                              className="flex items-center justify-center gap-2 w-full bg-white/10 text-white px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                              </svg>
                              Share / copy link
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : fileType === 'video' || fileType === 'video-stream' ? (
                    <video 
                      src={fileContent}
                      controls
                      className="max-w-full max-h-full"
                      playsInline
                      preload={fileType === 'video-stream' ? 'metadata' : 'auto'}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : fileType === 'audio' || fileType === 'audio-stream' ? (
                    <div className="text-center px-4 flex items-center justify-center w-full">
                      <div className="w-full max-w-md">
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5 text-4xl">
                          {getFileIcon(selectedFile)}
                        </div>
                        <h3 className="text-white text-base font-semibold mb-1 truncate px-4">
                          {selectedFile}
                        </h3>
                        {fileType === 'audio-stream' && (
                          <div className="inline-flex items-center gap-1.5 text-slate-400 text-xs mb-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                            Streaming
                          </div>
                        )}
                        {fileType !== 'audio-stream' && <div className="mb-5" />}
                        <audio 
                          src={fileContent}
                          controls
                          className="mx-auto w-full"
                          preload={fileType === 'audio-stream' ? 'metadata' : 'auto'}
                        >
                          Your browser does not support the audio tag.
                        </audio>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full flex flex-col ${isSharedFile(selectedFile) ? 'bg-white' : 'bg-slate-800/50'} rounded-xl overflow-hidden mx-2 sm:mx-0`}>
                      {/* Редактирование .shared файлов или просмотр обычных файлов */}
                      {isSharedFile(selectedFile) && fileType === 'text' ? (
                        <div className="flex-1 flex flex-col p-3 sm:p-6">
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h4 className="text-slate-900 text-sm font-semibold flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              Editing file
                            </h4>
                            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                              Ctrl+S to save
                            </span>
                          </div>
                          
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 w-full min-h-0 p-3 sm:p-4 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-xs sm:text-sm font-mono"
                            placeholder="Enter your content here…"
                            style={{ 
                              height: 'calc(100vh - 250px)',
                              minHeight: '300px'
                            }}
                          />
                          
                          <div className="mt-3 sm:mt-4">
                            <button
                              onClick={saveFileContent}
                              disabled={saving}
                              className="w-full bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {saving ? (
                                <>
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving…
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                  Save changes
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Обычный просмотр текстовых файлов */
                        <div 
                          className="flex-1 overflow-auto"
                          style={{ 
                            WebkitOverflowScrolling: 'touch',
                            height: 'calc(100vh - 200px)', 
                            maxHeight: 'calc(100vh - 200px)',
                            minHeight: '300px'
                          }}
                        >
                          <pre className="text-xs sm:text-sm text-slate-200 font-mono whitespace-pre-wrap p-3 sm:p-6 w-full leading-relaxed">
                            {fileContent}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
