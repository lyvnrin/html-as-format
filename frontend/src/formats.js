import TimelineCover from './covers/TimelineCover'
import BubbleMapCover from './covers/BubbleMapCover'
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
    id: 'bubble-map',
    label: 'Bubble map',
    description: 'Topics as an interactive cluster map',
    active: true,
    Cover: BubbleMapCover,
  },
]
