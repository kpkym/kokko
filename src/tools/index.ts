import { get_current_time } from './get_current_time';
import { read_file } from './read_file';
import { write_file } from './write_file';
import { edit_file } from './edit_file';
import { list_dir } from './list_dir';
import { glob } from './glob';
import { grep } from './grep';
import { bash } from './bash';

export const tools = {
  get_current_time,
  read_file,
  write_file,
  edit_file,
  list_dir,
  glob,
  grep,
  bash,
};
