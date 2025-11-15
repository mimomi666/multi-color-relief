import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { RGBColor, Layer, Settings, ProcessedData, GeometryData } from './types';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, Stage } from '@react-three/drei';
import { Upload, Download, Cog, Loader, Palette, Ruler, ArrowUp, ArrowDown, Github, Star } from 'lucide-react';

// --- HELPER FUNCTIONS ---

// Color distance calculation
const colorDistance = (c1: RGBColor, c2: RGBColor): number => {
  return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2));
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};


// --- UI HELPER COMPONENTS (defined outside main component to prevent re-renders) ---

interface PanelProps {
  title: string;
  icon: React.ReactNode;
  step: string;
  children: React.ReactNode;
  className?: string;
}

const Panel: React.FC<PanelProps> = ({ title, icon, step, children, className }) => (
  <div className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg p-4 md:p-6 ${className}`}>
    <div className="flex items-center mb-4">
      <div className="bg-indigo-600 rounded-full p-2 mr-4">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-indigo-400">{step}</p>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
    </div>
    {children}
  </div>
);

interface FileUploaderProps {
  onImageUpload: (src: string) => void;
  disabled: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onImageUpload, disabled }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageUpload(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageUpload(event.target?.result as string);
      };
      reader.readAsDataURL(e.dataTransfer.files[0]);
    }
  };

  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        disabled ? 'bg-gray-700 border-gray-600 cursor-not-allowed' : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
      }`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <Upload className={`w-8 h-8 mb-2 ${disabled ? 'text-gray-500' : 'text-gray-400'}`} />
        <p className={`mb-1 text-sm ${disabled ? 'text-gray-500' : 'text-gray-400'}`}>
          <span className="font-semibold">点击上传</span> 或拖放图片
        </p>
      </div>
      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={disabled} />
    </label>
  );
};

// --- CORE LOGIC (OPTIMIZED) ---

const processImage = (imageSrc: string, settings: Settings): Promise<ProcessedData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 256;
      let { width, height } = img;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round(height * (MAX_DIM / width));
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round(width * (MAX_DIM / height));
          height = MAX_DIM;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels: RGBColor[] = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
      }

      // K-Means clustering with sampling for performance
      const SAMPLE_SIZE = 10000;
      let samplePixels = pixels;
      if (pixels.length > SAMPLE_SIZE) {
          samplePixels = [];
          const step = Math.floor(pixels.length / SAMPLE_SIZE);
          for (let i = 0; i < SAMPLE_SIZE; i++) {
            samplePixels.push(pixels[(i * step) % pixels.length]);
          }
      }
      
      let centroids: RGBColor[] = [];
      const usedIndices = new Set<number>();
      for (let i = 0; i < settings.numColors; i++) {
          let index;
          do {
              index = Math.floor(Math.random() * samplePixels.length);
          } while (usedIndices.has(index));
          usedIndices.add(index);
          centroids.push(samplePixels[index]);
      }
      
      const sampleAssignments = new Array(samplePixels.length);
      const MAX_ITERATIONS = 30;

      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        for (let p = 0; p < samplePixels.length; p++) {
          let minDist = Infinity;
          let bestCentroid = 0;
          for (let c = 0; c < centroids.length; c++) {
            const dist = colorDistance(samplePixels[p], centroids[c]);
            if (dist < minDist) {
              minDist = dist;
              bestCentroid = c;
            }
          }
          sampleAssignments[p] = bestCentroid;
        }

        const newCentroids: RGBColor[] = Array.from({ length: settings.numColors }, () => [0, 0, 0]);
        const counts = new Array(settings.numColors).fill(0);
        for (let p = 0; p < samplePixels.length; p++) {
          const cIndex = sampleAssignments[p];
          newCentroids[cIndex][0] += samplePixels[p][0];
          newCentroids[cIndex][1] += samplePixels[p][1];
          newCentroids[cIndex][2] += samplePixels[p][2];
          counts[cIndex]++;
        }

        let moved = false;
        for (let c = 0; c < centroids.length; c++) {
          if (counts[c] > 0) {
            const newCentroid: RGBColor = [
                Math.round(newCentroids[c][0] / counts[c]),
                Math.round(newCentroids[c][1] / counts[c]),
                Math.round(newCentroids[c][2] / counts[c])
            ];
            if(colorDistance(newCentroid, centroids[c]) > 1){
                moved = true;
            }
            centroids[c] = newCentroid;
          } else {
            const newIndex = Math.floor(Math.random() * samplePixels.length);
            centroids[c] = samplePixels[newIndex];
            moved = true;
          }
        }
        if(!moved) break;
      }
      
      const unsortedCentroids = [...centroids];
      const brightness = (c: RGBColor) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      centroids.sort((a, b) => brightness(a) - brightness(b));

      const processedImageData = ctx.createImageData(width, height);
      const heightMap = new Uint8Array(pixels.length);

      const colorToSortedIndexMap = new Map<string, number>();
      centroids.forEach((c, index) => {
        colorToSortedIndexMap.set(JSON.stringify(c), index);
      });

      const findClosestColor = (color: RGBColor): RGBColor => {
          let minDist = Infinity;
          let bestCentroid: RGBColor = unsortedCentroids[0];
          for (const centroid of unsortedCentroids) {
              const dist = colorDistance(color, centroid);
              if (dist < minDist) {
                  minDist = dist;
                  bestCentroid = centroid;
              }
          }
          return bestCentroid;
      };

      // 增强边缘检测：保护边缘和深色线条
      const edgeMap = new Float32Array(pixels.length);
      const darkLineMap = new Float32Array(pixels.length);
      
      if (settings.edgePreservation) {
        // 第一步：Sobel边缘检测
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // 计算灰度值用于边缘检测
            const getGray = (i: number): number => {
              if (i < 0 || i >= pixels.length) return 0;
              const p = pixels[i];
              return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
            };
            
            // Sobel算子 - 检测边缘
            const gx = 
              -getGray((y-1)*width + (x-1)) + getGray((y-1)*width + (x+1)) +
              -2*getGray(y*width + (x-1)) + 2*getGray(y*width + (x+1)) +
              -getGray((y+1)*width + (x-1)) + getGray((y+1)*width + (x+1));
            
            const gy = 
              -getGray((y-1)*width + (x-1)) - 2*getGray((y-1)*width + x) - getGray((y-1)*width + (x+1)) +
              getGray((y+1)*width + (x-1)) + 2*getGray((y+1)*width + x) + getGray((y+1)*width + (x+1));
            
            // 边缘强度 - 使用更敏感的阈值
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edgeMap[idx] = Math.min(1, magnitude / 200); // 降低阈值，更敏感
            
            // 第二步：检测深色像素（可能是线条）
            const currentGray = getGray(idx);
            const avgNeighborGray = (
              getGray((y-1)*width + x) + getGray((y+1)*width + x) +
              getGray(y*width + (x-1)) + getGray(y*width + (x+1))
            ) / 4;
            
            // 如果当前像素比周围暗很多，标记为深色线条
            const isDarkLine = currentGray < 100 && (avgNeighborGray - currentGray) > 30;
            darkLineMap[idx] = isDarkLine ? 1.0 : 0.0;
          }
        }
        
        // 第三步：膨胀操作，扩展边缘保护区域
        const expandedEdgeMap = new Float32Array(pixels.length);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            let maxEdge = edgeMap[idx];
            
            // 检查周围3x3区域的最大值
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nIdx = (y + dy) * width + (x + dx);
                if (nIdx >= 0 && nIdx < pixels.length) {
                  maxEdge = Math.max(maxEdge, edgeMap[nIdx]);
                }
              }
            }
            
            // 合并边缘和深色线条检测结果
            expandedEdgeMap[idx] = Math.max(maxEdge, darkLineMap[idx]);
          }
        }
        
        // 使用膨胀后的边缘图
        for (let i = 0; i < pixels.length; i++) {
          edgeMap[i] = expandedEdgeMap[i];
        }
      }

      if (settings.dithering) {
        const pixelsFloat = new Float32Array(imageData.data.length);
        for(let i=0; i < imageData.data.length; i += 4) {
            pixelsFloat[i]   = imageData.data[i];
            pixelsFloat[i+1] = imageData.data[i+1];
            pixelsFloat[i+2] = imageData.data[i+2];
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const i_1d = y * width + x;
                
                const oldColor: RGBColor = [pixelsFloat[i], pixelsFloat[i+1], pixelsFloat[i+2]];
                const newColor = findClosestColor(oldColor);
                
                const sortedIndex = colorToSortedIndexMap.get(JSON.stringify(newColor)) ?? 0;

                processedImageData.data[i]     = newColor[0];
                processedImageData.data[i + 1] = newColor[1];
                processedImageData.data[i + 2] = newColor[2];
                processedImageData.data[i + 3] = 255;
                heightMap[i_1d] = sortedIndex;

                // 增强边缘保护：在边缘和深色线条区域完全禁用抖动
                const edgeStrength = settings.edgePreservation ? edgeMap[i_1d] : 0;
                // 如果边缘强度超过0.3，完全禁用抖动；否则逐渐减弱
                const ditherStrength = edgeStrength > 0.3 ? 0 : (1 - edgeStrength * 3);

                const errR = (oldColor[0] - newColor[0]) * ditherStrength;
                const errG = (oldColor[1] - newColor[1]) * ditherStrength;
                const errB = (oldColor[2] - newColor[2]) * ditherStrength;

                const distributeError = (dx: number, dy: number, factor: number) => {
                    if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
                        const ni = ((y + dy) * width + (x + dx)) * 4;
                        pixelsFloat[ni]     = Math.max(0, Math.min(255, pixelsFloat[ni]     + errR * factor));
                        pixelsFloat[ni + 1] = Math.max(0, Math.min(255, pixelsFloat[ni + 1] + errG * factor));
                        pixelsFloat[ni + 2] = Math.max(0, Math.min(255, pixelsFloat[ni + 2] + errB * factor));
                    }
                };

                distributeError(1, 0, 7 / 16);
                distributeError(-1, 1, 3 / 16);
                distributeError(0, 1, 5 / 16);
                distributeError(1, 1, 1 / 16);
            }
        }
      } else {
        for (let i = 0; i < pixels.length; i++) {
            const originalPixelColor = pixels[i];
            const newColor = findClosestColor(originalPixelColor);
            const sortedIndex = colorToSortedIndexMap.get(JSON.stringify(newColor)) ?? 0;

            processedImageData.data[i * 4]     = newColor[0];
            processedImageData.data[i * 4 + 1] = newColor[1];
            processedImageData.data[i * 4 + 2] = newColor[2];
            processedImageData.data[i * 4 + 3] = 255;
            heightMap[i] = sortedIndex;
        }
      }

      // 反转顺序，使背景颜色作为第一层，然后重新分配高度
      const reversedCentroids = [...centroids].reverse();
      
      // 第一层0.8mm，其余层每层0.4mm
      const firstLayerThickness = 0.8;
      const normalLayerThickness = 0.4;
      let cumulativeHeight = 0;
      
      const initialLayers: Layer[] = reversedCentroids.map((c, i) => {
        if (i === 0) {
          cumulativeHeight = firstLayerThickness;
        } else {
          cumulativeHeight += normalLayerThickness;
        }
        return {
          id: centroids.length - 1 - i, // 保持原始ID对应关系
          color: c,
          hex: rgbToHex(c[0], c[1], c[2]),
          height: parseFloat(cumulativeHeight.toFixed(2)), // 保留2位小数
        };
      });

      resolve({ layers: initialLayers, processedImage: processedImageData, heightMap, width, height });
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

const generateSTL = (geometryData: GeometryData, settings: Settings): Blob => {
    const { geometry } = geometryData;
    const positions = geometry.attributes.position.array;
    const index = geometry.index;
    
    if (!index) {
        throw new Error("Geometry must have an index");
    }
    
    const indices = index.array;
    const triangles = indices.length / 3;

    const buffer = new ArrayBuffer(84 + triangles * 50);
    const view = new DataView(buffer);
    let offset = 80;

    view.setUint32(offset, triangles, true);
    offset += 4;

    for (let i = 0; i < triangles; i++) {
        // Get vertex indices for this triangle
        const i0 = indices[i * 3];
        const i1 = indices[i * 3 + 1];
        const i2 = indices[i * 3 + 2];
        
        // Get three vertices of the triangle
        const v1 = new THREE.Vector3(
            positions[i0 * 3],
            positions[i0 * 3 + 1],
            positions[i0 * 3 + 2]
        );
        const v2 = new THREE.Vector3(
            positions[i1 * 3],
            positions[i1 * 3 + 1],
            positions[i1 * 3 + 2]
        );
        const v3 = new THREE.Vector3(
            positions[i2 * 3],
            positions[i2 * 3 + 1],
            positions[i2 * 3 + 2]
        );
        
        // Calculate normal from vertices (right-hand rule)
        const edge1 = new THREE.Vector3().subVectors(v2, v1);
        const edge2 = new THREE.Vector3().subVectors(v3, v1);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        
        // Write Normal
        view.setFloat32(offset, normal.x, true); offset += 4;
        view.setFloat32(offset, normal.y, true); offset += 4;
        view.setFloat32(offset, normal.z, true); offset += 4;
        
        // Write Vertices
        view.setFloat32(offset, v1.x, true); offset += 4;
        view.setFloat32(offset, v1.y, true); offset += 4;
        view.setFloat32(offset, v1.z, true); offset += 4;
        
        view.setFloat32(offset, v2.x, true); offset += 4;
        view.setFloat32(offset, v2.y, true); offset += 4;
        view.setFloat32(offset, v2.z, true); offset += 4;
        
        view.setFloat32(offset, v3.x, true); offset += 4;
        view.setFloat32(offset, v3.y, true); offset += 4;
        view.setFloat32(offset, v3.z, true); offset += 4;
        
        // Attribute byte count
        view.setUint16(offset, 0, true); offset += 2;
    }

    return new Blob([buffer], { type: 'application/sla' });
};

// --- 3D Components ---

const Model: React.FC<{ geometryData: GeometryData | null }> = ({ geometryData }) => {
    const mesh = useRef<THREE.Mesh>(null!);

    if (!geometryData) return null;

    return (
        <mesh ref={mesh} geometry={geometryData.geometry}>
            <meshStandardMaterial color="#cccccc" flatShading={false} />
        </mesh>
    );
};

const Controls: React.FC = () => {
    return <OrbitControls />;
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [settings, setSettings] = useState<Settings>({
    numColors: 4,
    baseThickness: 0.8,
    modelWidth: 100,
    pixelSize: 0.4,
    dithering: true,
    edgePreservation: false,
  });
  const [layers, setLayers] = useState<Layer[] | null>(null);
  const [userOrderedLayers, setUserOrderedLayers] = useState<Layer[] | null>(null);
  const [geometryData, setGeometryData] = useState<GeometryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (imageSrc && originalCanvasRef.current) {
      const canvas = originalCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  // Render final preview with current layer order
  useEffect(() => {
    if (processedData && layers && processedCanvasRef.current) {
      const canvas = processedCanvasRef.current;
      canvas.width = processedData.width;
      canvas.height = processedData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create a mapping from original layer ID to new index
      const idToNewIndex = new Map<number, number>();
      layers.forEach((layer, newIndex) => {
        idToNewIndex.set(layer.id, newIndex);
      });

      const imageData = ctx.createImageData(processedData.width, processedData.height);
      const { heightMap } = processedData;

      for (let i = 0; i < heightMap.length; i++) {
        const originalLayerId = heightMap[i];
        const newIndex = idToNewIndex.get(originalLayerId) ?? 0;
        const layer = layers[newIndex];
        
        imageData.data[i * 4] = layer.color[0];
        imageData.data[i * 4 + 1] = layer.color[1];
        imageData.data[i * 4 + 2] = layer.color[2];
        imageData.data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    }
  }, [processedData, layers]);

  const handleProcess = useCallback(async () => {
    if (!imageSrc) return;
    setIsLoading(true);
    setLoadingMessage('正在处理图片，请稍候...');
    try {
      const data = await processImage(imageSrc, settings);
      setProcessedData(data);
      
      // 如果用户已经自定义了顺序，保持该顺序并更新颜色
      if (userOrderedLayers && userOrderedLayers.length === data.layers.length) {
        // 创建ID到新图层的映射
        const idToNewLayer = new Map(data.layers.map(l => [l.id, l]));
        // 保持用户的顺序，但使用新的颜色数据
        const updatedLayers = userOrderedLayers.map(oldLayer => {
          const newLayer = idToNewLayer.get(oldLayer.id);
          return newLayer ? { ...newLayer, height: oldLayer.height } : oldLayer;
        });
        setLayers(updatedLayers);
      } else {
        // 首次处理或颜色数量改变，使用新顺序
        setLayers(data.layers);
        setUserOrderedLayers(data.layers);
      }
    } catch (error) {
      console.error("Image processing failed:", error);
      alert("图片处理失败，请检查浏览器控制台。");
    } finally {
      setIsLoading(false);
    }
  }, [imageSrc, settings, userOrderedLayers]);
  
  const handleDownload = useCallback(() => {
    if(!geometryData || !processedData) return;
    setIsLoading(true);
    setLoadingMessage('正在生成模型文件...');
    try {
      const blob = generateSTL(geometryData, settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hueforge_model.stl';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(error) {
        console.error("Failed to generate STL:", error);
        alert("STL文件生成失败。");
    } finally {
        setIsLoading(false);
    }
  }, [geometryData, settings, processedData]);
  
  const updateLayerHeight = (id: number, height: number) => {
    setLayers(currentLayers => 
        currentLayers?.map(l => l.id === id ? {...l, height: height} : l) || null
    );
    setUserOrderedLayers(currentLayers => 
        currentLayers?.map(l => l.id === id ? {...l, height: height} : l) || null
    );
  };

  const updateLayerColor = (id: number, hexColor: string) => {
    // 将hex转换为RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgb: RGBColor = [r, g, b];
    
    setLayers(currentLayers => 
        currentLayers?.map(l => l.id === id ? {...l, color: rgb, hex: hexColor.toUpperCase()} : l) || null
    );
    setUserOrderedLayers(currentLayers => 
        currentLayers?.map(l => l.id === id ? {...l, color: rgb, hex: hexColor.toUpperCase()} : l) || null
    );
  };

  // 重新计算图层的累积高度（打印顺序从下到上）
  const recalculateLayerHeights = (layersArray: Layer[]): Layer[] => {
    const firstLayerThickness = 0.8; // 第一层（背景）厚度为0.8mm
    const normalLayerThickness = 0.4; // 其余层厚度为0.4mm
    
    let cumulativeHeight = 0;
    return layersArray.map((layer, index) => {
      if (index === 0) {
        cumulativeHeight = firstLayerThickness;
      } else {
        cumulativeHeight += normalLayerThickness;
      }
      return {
        ...layer,
        height: parseFloat(cumulativeHeight.toFixed(2)) // 保留2位小数
      };
    });
  };

  const moveLayerUp = (index: number) => {
    if (index === 0 || !layers) return;
    setLayers(currentLayers => {
      if (!currentLayers) return null;
      const newLayers = [...currentLayers];
      [newLayers[index - 1], newLayers[index]] = [newLayers[index], newLayers[index - 1]];
      const recalculated = recalculateLayerHeights(newLayers);
      setUserOrderedLayers(recalculated);
      return recalculated;
    });
  };

  const moveLayerDown = (index: number) => {
    if (!layers || index === layers.length - 1) return;
    setLayers(currentLayers => {
      if (!currentLayers) return null;
      const newLayers = [...currentLayers];
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      const recalculated = recalculateLayerHeights(newLayers);
      setUserOrderedLayers(recalculated);
      return recalculated;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || !layers) return;
    
    const newLayers = [...layers];
    const [draggedItem] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(dropIndex, 0, draggedItem);
    
    const recalculated = recalculateLayerHeights(newLayers);
    setLayers(recalculated);
    setUserOrderedLayers(recalculated);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  useEffect(() => {
    if (processedData && layers) {
      const { heightMap, width, height } = processedData;
      const { modelWidth } = settings;
      
      const modelHeight = (modelWidth / width) * height;
      const finalPixelSize = modelWidth / width;
      
      const indices: number[] = [];
      const positions: number[] = [];
      const vertexMap = new Map<string, number>();
      
      // Create mapping from original layer ID to current position in layers array
      const idToCurrentIndex = new Map<number, number>();
      layers.forEach((layer, index) => {
        idToCurrentIndex.set(layer.id, index);
      });
      
      const getHeight = (x: number, y: number): number => {
          if (x < 0 || x >= width || y < 0 || y >= height) return 0;
          const originalLayerId = heightMap[y * width + x];
          const currentIndex = idToCurrentIndex.get(originalLayerId) ?? 0;
          const layer = layers[currentIndex];
          return layer?.height || 0;
      }

      // Helper to add or get vertex index
      const addVertex = (x: number, y: number, z: number): number => {
        const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
        if (vertexMap.has(key)) {
          return vertexMap.get(key)!;
        }
        const index = positions.length / 3;
        positions.push(x, y, z);
        vertexMap.set(key, index);
        return index;
      };

      // Helper to add a triangle
      const addTriangle = (i0: number, i1: number, i2: number) => {
        indices.push(i0, i1, i2);
      };

      // Create vertex indices grid for top and bottom surfaces
      const topIndices: number[][] = Array.from({ length: height }, () => new Array(width));
      const bottomIndices: number[][] = Array.from({ length: height }, () => new Array(width));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const px = (x - width / 2) * finalPixelSize;
          const py = -(y - height / 2) * finalPixelSize;
          topIndices[y][x] = addVertex(px, py, getHeight(x, y));
          bottomIndices[y][x] = addVertex(px, py, 0);
        }
      }

      // Top surface triangles
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const i0 = topIndices[y][x];
          const i1 = topIndices[y][x+1];
          const i2 = topIndices[y+1][x];
          const i3 = topIndices[y+1][x+1];
          // CCW winding for upward normal
          addTriangle(i0, i1, i2);
          addTriangle(i2, i1, i3);
        }
      }

      // Bottom surface triangles
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const i0 = bottomIndices[y][x];
          const i1 = bottomIndices[y][x+1];
          const i2 = bottomIndices[y+1][x];
          const i3 = bottomIndices[y+1][x+1];
          // CW winding for downward normal
          addTriangle(i0, i2, i1);
          addTriangle(i1, i2, i3);
        }
      }

      // Side walls - Top edge (y=0)
      for (let x = 0; x < width - 1; x++) {
        const t0 = topIndices[0][x];
        const t1 = topIndices[0][x+1];
        const b0 = bottomIndices[0][x];
        const b1 = bottomIndices[0][x+1];
        addTriangle(t0, t1, b0);
        addTriangle(b0, t1, b1);
      }
      
      // Side walls - Bottom edge (y=height-1)
      for (let x = 0; x < width - 1; x++) {
        const t0 = topIndices[height-1][x];
        const t1 = topIndices[height-1][x+1];
        const b0 = bottomIndices[height-1][x];
        const b1 = bottomIndices[height-1][x+1];
        addTriangle(t1, t0, b1);
        addTriangle(b1, t0, b0);
      }
      
      // Side walls - Left edge (x=0)
      for (let y = 0; y < height - 1; y++) {
        const t0 = topIndices[y][0];
        const t1 = topIndices[y+1][0];
        const b0 = bottomIndices[y][0];
        const b1 = bottomIndices[y+1][0];
        addTriangle(t1, t0, b1);
        addTriangle(b1, t0, b0);
      }

      // Side walls - Right edge (x=width-1)
      for (let y = 0; y < height - 1; y++) {
        const t0 = topIndices[y][width-1];
        const t1 = topIndices[y+1][width-1];
        const b0 = bottomIndices[y][width-1];
        const b1 = bottomIndices[y+1][width-1];
        addTriangle(t0, t1, b0);
        addTriangle(b0, t1, b1);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals(); 

      const maxLayerHeight = Math.max(...layers.map(l => l.height), 0);

      setGeometryData({
        geometry,
        width: modelWidth,
        height: modelHeight,
        depth: maxLayerHeight
      });
    }
  }, [processedData, layers, settings]);

  const maxModelDim = useMemo(() => {
      if(!geometryData) return 100;
      return Math.max(geometryData.width, geometryData.height, geometryData.depth) * 1.2;
  }, [geometryData]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 md:p-8">
        <header className="text-center mb-8 relative">
            <a 
                href="https://github.com/mimomi666/multi-color-relief" 
                target="_blank" 
                rel="noopener noreferrer"
                className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
                title="Star on GitHub"
            >
                <Github size={20} className="group-hover:scale-110 transition-transform" />
                <Star size={16} className="group-hover:fill-yellow-400 group-hover:text-yellow-400 transition-colors" />
                <span className="text-sm font-medium">Star</span>
            </a>
            <h1 className="text-4xl md:text-5xl font-bold text-white">HueForge Web</h1>
            <p className="text-indigo-400 mt-2">3D打印颜色浮雕生成器</p>
        </header>

        {isLoading && (
            <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
                <Loader className="w-16 h-16 animate-spin text-indigo-500" />
                <p className="mt-4 text-xl">{loadingMessage}</p>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Panel title="上传图片" icon={<Upload size={20}/>} step="步骤一">
                    <FileUploader onImageUpload={setImageSrc} disabled={isLoading}/>
                </Panel>
                
                <Panel title="参数设置" icon={<Cog size={20}/>} step="步骤二">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="numColors" className="block text-sm font-medium mb-1">颜色数量: {settings.numColors}</label>
                            <input id="numColors" type="range" min="2" max="16" value={settings.numColors} onChange={e => setSettings({...settings, numColors: parseInt(e.target.value)})} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" disabled={!imageSrc || isLoading}/>
                        </div>
                        <div className="flex items-center justify-between py-1">
                            <div>
                                <label htmlFor="edgePreservation" className="text-sm font-medium">边缘保护 ⭐</label>
                                <p className="text-xs text-gray-400">保留细节线条，推荐人像使用</p>
                            </div>
                            <label htmlFor="edgePreservation" className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="edgePreservation"
                                    className="sr-only peer" 
                                    checked={settings.edgePreservation}
                                    onChange={e => setSettings({...settings, edgePreservation: e.target.checked})}
                                    disabled={!imageSrc || isLoading}
                                />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between py-1">
                            <label htmlFor="dithering" className="text-sm font-medium">颜色抖动</label>
                            <label htmlFor="dithering" className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="dithering"
                                    className="sr-only peer" 
                                    checked={settings.dithering}
                                    onChange={e => setSettings({...settings, dithering: e.target.checked})}
                                    disabled={!imageSrc || isLoading}
                                />
                                <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <div>
                            <label htmlFor="modelWidth" className="block text-sm font-medium mb-1">模型宽度 (mm)</label>
                            <input id="modelWidth" type="number" value={settings.modelWidth} onChange={e => setSettings({...settings, modelWidth: parseFloat(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1" disabled={!imageSrc || isLoading}/>
                        </div>
                        <button onClick={handleProcess} disabled={!imageSrc || isLoading} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                            开始处理
                        </button>
                    </div>
                </Panel>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <Panel title="预览" icon={<Ruler size={20}/>} step="查看结果">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-center">原始图片</h3>
                            <div className="bg-gray-900/50 p-2 rounded-md aspect-square flex items-center justify-center">
                                {imageSrc ? <canvas ref={originalCanvasRef} className="max-w-full max-h-full object-contain"/> : <p className="text-gray-500">请先上传一张图片</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-center">最终效果</h3>
                             <div className="bg-gray-900/50 p-2 rounded-md aspect-square flex items-center justify-center">
                                {processedData && layers ? (
                                    <canvas ref={processedCanvasRef} className="max-w-full max-h-full object-contain" style={{imageRendering: 'pixelated'}}/>
                                ) : (
                                    <p className="text-gray-500">点击"开始处理"生成结果</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Panel>

                {layers && (
                    <Panel title="图层颜色与高度" icon={<Palette size={20}/>} step="步骤三">
                        <div className="mb-3 p-2 bg-blue-900/30 border border-blue-700 rounded-md text-sm text-blue-200">
                            <p className="font-semibold mb-1">💡 操作提示</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>点击颜色方框</strong>：修改图层颜色</li>
                                <li><strong>拖拽图层</strong>或使用↑↓按钮：调整顺序</li>
                                <li><strong>修改数值</strong>：设置图层高度</li>
                            </ul>
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                           {layers.map((layer, index) => (
                               <div 
                                   key={layer.id} 
                                   draggable
                                   onDragStart={() => handleDragStart(index)}
                                   onDragOver={(e) => handleDragOver(e, index)}
                                   onDrop={(e) => handleDrop(e, index)}
                                   onDragEnd={handleDragEnd}
                                   className={`flex items-center space-x-2 bg-gray-700/50 p-2 rounded-md cursor-move transition-all ${
                                       draggedIndex === index ? 'opacity-50 scale-95' : 'hover:bg-gray-700'
                                   }`}
                               >
                                   <div className="flex flex-col space-y-1">
                                       <button 
                                           onClick={() => moveLayerUp(index)}
                                           disabled={index === 0}
                                           className="p-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded transition-colors"
                                           title="上移图层"
                                       >
                                           <ArrowUp size={14} />
                                       </button>
                                       <button 
                                           onClick={() => moveLayerDown(index)}
                                           disabled={index === layers.length - 1}
                                           className="p-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded transition-colors"
                                           title="下移图层"
                                       >
                                           <ArrowDown size={14} />
                                       </button>
                                   </div>
                                   <div className="relative group">
                                       <input 
                                           type="color" 
                                           value={layer.hex} 
                                           onChange={e => updateLayerColor(layer.id, e.target.value)}
                                           className="w-8 h-8 rounded border border-gray-500 cursor-pointer opacity-0 absolute inset-0"
                                           title="点击修改颜色"
                                       />
                                       <div 
                                           className="w-8 h-8 rounded border-2 border-gray-500 group-hover:border-indigo-400 flex-shrink-0 transition-colors cursor-pointer" 
                                           style={{backgroundColor: layer.hex}}
                                           title="点击修改颜色"
                                       ></div>
                                   </div>
                                   <span className="text-sm font-mono flex-1 min-w-0">{layer.hex}</span>
                                   <input 
                                       type="number" 
                                       value={layer.height.toFixed(2)} 
                                       onChange={e => updateLayerHeight(layer.id, parseFloat(e.target.value))} 
                                       step="0.01" 
                                       className="w-16 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-right text-sm"
                                   />
                                   <span className="text-xs text-gray-400 w-8">mm</span>
                               </div>
                           ))}
                        </div>
                        <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-700 rounded-md text-sm text-indigo-200">
                            <p className="font-bold mb-1">🖨️ 打印说明</p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                                <li><strong>高度值</strong>：表示该颜色打印到的累积高度（从底部开始）</li>
                                <li><strong>打印顺序</strong>：从上到下依次打印（第一层到最后一层）</li>
                                <li><strong>换色操作</strong>：在切片软件中，根据高度值设置暂停或换料</li>
                            </ul>
                        </div>
                         <button onClick={handleDownload} disabled={!geometryData || isLoading} className="w-full mt-4 bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
                           <Download size={18} className="mr-2"/> 下载 .STL 模型文件
                        </button>
                    </Panel>
                )}
            </div>
        </div>
    </div>
  );
}