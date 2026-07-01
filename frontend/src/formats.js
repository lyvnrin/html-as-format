import TimelineCover from './covers/TimelineCover'
import MeetingNotesCover from './covers/MeetingNotesCover'
import CaseStudyCover from './covers/CaseStudyCover'
import BubbleMapCover from './covers/BubbleMapCover'
import ResearchBriefCover from './covers/ResearchBriefCover'
import ProjectUpdateCover from './covers/ProjectUpdateCover'
import MagazineCover from './covers/MagazineCover'

export const formats = [
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Slides as an interactive horizontal timeline',
    active: true,
    Cover: TimelineCover,
  },
  {
    id: 'magazine',
    label: 'Magazine',
    description: 'Slides as a Pinterest-style masonry grid',
    active: true,
    Cover: MagazineCover,
  },
  {
    id: 'meeting-notes',
    label: 'Meeting notes',
    description: 'Attendees, actions, decisions',
    active: false,
    Cover: MeetingNotesCover,
  },
  {
    id: 'case-study',
    label: 'Case study',
    description: 'Hero, timeline, key moments',
    active: false,
    Cover: CaseStudyCover,
  },
  {
    id: 'bubble-map',
    label: 'Bubble map',
    description: 'Topics as an interactive cluster map',
    active: false,
    Cover: BubbleMapCover,
  },
  {
    id: 'research-brief',
    label: 'Research brief',
    description: 'Findings, evidence, recommendations',
    active: false,
    Cover: ResearchBriefCover,
  },
  {
    id: 'project-update',
    label: 'Project update',
    description: 'Status, risks, next steps',
    active: false,
    Cover: ProjectUpdateCover,
  },
]
