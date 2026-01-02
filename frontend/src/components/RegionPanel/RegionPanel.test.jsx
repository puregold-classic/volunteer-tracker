import { render, screen } from '@testing-library/react'
import RegionPanel from './RegionPanel'

describe('RegionPanel', () => {
it('renders correctly', () => {
render(<RegionPanel />)
expect(screen.getByText('RegionPanel Component')).toBeInTheDocument()
})
})
