type RuFileInputProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  buttonText?: string;
  emptyText?: string;
};

export function RuFileInput({
  file,
  onChange,
  buttonText = "Выбрать файл",
  emptyText = "Файл не выбран",
}: RuFileInputProps) {
  return (
    <label className="ru-file-input">
      <input
        type="file"
        className="ru-file-input-native"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span className="ru-file-input-button">{buttonText}</span>
      <span className="ru-file-input-name" title={file?.name || emptyText}>
        {file?.name || emptyText}
      </span>
    </label>
  );
}
