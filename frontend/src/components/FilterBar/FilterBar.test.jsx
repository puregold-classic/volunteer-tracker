import { render, screen } from '@testing-library/react'
import FilterBar from './FilterBar'

describe('FilterBar', () => {
it('renders correctly', () => {
render(<FilterBar />)
expect(screen.getByText('FilterBar Component')).toBeInTheDocument()
})
})
