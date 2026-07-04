/**
 * Thin abstraction over ONNX Runtime so the engine runs unchanged on
 * onnxruntime-react-native (app) and onnxruntime-node (tests / CI).
 *
 * Both packages implement the same InferenceSession/Tensor API; this interface
 * captures only the slice we use so neither package is a hard import here.
 */

export interface OrtTensor {
  data: unknown;
  dims: readonly number[];
  type: string;
}

export interface OrtSession {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  inputNames: readonly string[];
  outputNames: readonly string[];
}

export interface OrtBackend {
  createSession(modelPath: string): Promise<OrtSession>;
  /** Construct a tensor — mirrors `new ort.Tensor(type, data, dims)`. */
  tensor(type: "int64" | "float32", data: BigInt64Array | Float32Array, dims: number[]): OrtTensor;
}

/** Adapter for onnxruntime-node / onnxruntime-react-native (identical APIs). */
export function makeBackend(ort: {
  InferenceSession: { create(path: string): Promise<unknown> };
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
}): OrtBackend {
  return {
    createSession: async (p) => (await ort.InferenceSession.create(p)) as OrtSession,
    tensor: (type, data, dims) => new ort.Tensor(type, data, dims) as OrtTensor,
  };
}
