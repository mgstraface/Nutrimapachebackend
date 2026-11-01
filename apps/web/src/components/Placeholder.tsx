import { Mapache } from '../mascot/Mapache';

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="page placeholder">
      <h1 className="page-title">{title}</h1>
      <Mapache expression="curiosidad" size={140} />
      <p className="muted">{text}</p>
    </div>
  );
}
