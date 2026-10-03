import { useEffect, useRef } from 'preact/hooks';
import { Stage, type CameraPreset } from '../three/Stage';
import type { View } from '../lib/view';

interface Props {
  view: View | null;
  /** Bumped by the parent to ask for a camera preset. */
  preset: { name: CameraPreset; n: number };
  autoRotate: boolean;
  /** Height in px of the overlay covering the bottom of the view. */
  inset: number;
}

export default function Viewer({ view, preset, autoRotate, inset }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const first = useRef(true);

  useEffect(() => {
    stage.current = new Stage(host.current!);
    // Exposed for debugging in the browser console.
    (window as unknown as { stage: Stage }).stage = stage.current;
    return () => stage.current?.dispose();
  }, []);

  useEffect(() => stage.current?.setInset(inset), [inset]);

  useEffect(() => {
    if (!view || !stage.current) return;
    stage.current.setView(view, !first.current);
    first.current = false;
  }, [view]);

  useEffect(() => {
    if (preset.n) stage.current?.preset(preset.name);
  }, [preset]);

  useEffect(() => stage.current?.setAutoRotate(autoRotate), [autoRotate]);

  return <div class="viewer" ref={host} />;
}
