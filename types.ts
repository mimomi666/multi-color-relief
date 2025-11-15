import { BufferGeometry } from 'three';

export type RGBColor = [number, number, number];

export interface Layer {
  id: number;
  color: RGBColor;
  hex: string;
  height: number;
}

export interface Settings {
  numColors: number;
  baseThickness: number;
  modelWidth: number;
  pixelSize: number;
  dithering: boolean;
  edgePreservation: boolean;
}

export interface ProcessedData {
  layers: Layer[];
  processedImage: ImageData;
  heightMap: Uint8Array;
  width: number;
  height: number;
}

export interface GeometryData {
  geometry: BufferGeometry;
  width: number;
  height: number;
  depth: number;
}