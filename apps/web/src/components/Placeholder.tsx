import { Cachete } from '../mascot/Cachete';

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="page placeholder">
      <h1 className="page-title">{title}</h1>
      <Cachete expression="curiosidad" size={130} />
      <p className="muted">{text}</p>
    </div>
  );
}
