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
  /** Spoken name of the 3D view, and the id of the element that describes the scene in text. */
  label: string;
  describedBy: string;
}

export default function Viewer({ view, preset, autoRotate, inset, label, describedBy }: Props) {
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

  // The canvas is a picture: the text description is what assistive tech reads. The wrapper is focusable
  // so the keyboard camera (W A S D…) only listens while it has focus (WCAG 2.1.4).
  return (
    <div class="viewer" ref={host} tabIndex={0} role="group" aria-roledescription="3D" aria-label={label} aria-describedby={describedBy} />
  );
}
