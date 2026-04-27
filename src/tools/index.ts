import { get_current_time } from './get_current_time';
import { read_file } from './read_file';
import { write_file } from './write_file';
import { edit_file } from './edit_file';
import { list_dir } from './list_dir';
import { glob } from './glob';
import { grep } from './grep';
import { bash } from './bash';
import { web_search } from './web_search';
import { createLoadSkill } from './load_skill';
import type { SkillMetadata } from '../skills/types';

export function buildTools({ skills }: { skills: SkillMetadata[] }) {
  return {
    get_current_time,
    read_file,
    write_file,
    edit_file,
    list_dir,
    glob,
    grep,
    bash,
    web_search,
    load_skill: createLoadSkill(skills),
  };
}
