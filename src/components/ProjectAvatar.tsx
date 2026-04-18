import { avatarColor } from '../lib/avatarColor';

interface Props {
  name: string;
  thumbnail?: string | null;
  sizePx?: number;
}

export function ProjectAvatar({ name, thumbnail, sizePx = 28 }: Props) {
  const style = { width: sizePx, height: sizePx };

  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt={name}
        style={style}
        className="rounded object-cover shrink-0"
      />
    );
  }

  const { bg, fg } = avatarColor(name);
  return (
    <div
      className={`rounded flex items-center justify-center font-semibold shrink-0 text-xs ${bg} ${fg}`}
      style={style}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}
