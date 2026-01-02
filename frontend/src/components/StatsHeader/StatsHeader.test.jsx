import { render, screen } from '@testing-library/react'
import StatsHeader from './StatsHeader'

describe('StatsHeader', () => {
it('renders correctly', () => {
render(<StatsHeader />)
expect(screen.getByText('StatsHeader Component')).toBeInTheDocument()
})
})
