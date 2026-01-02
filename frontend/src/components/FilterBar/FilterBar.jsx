import React from 'react'
import PropTypes from 'prop-types'
import './FilterBar.scss'

const FilterBar = ({ data, onAction }) => {
return (
<div className="FilterBar">
<h3>FilterBar Component</h3>
<p>Component implementation goes here</p>
</div>
)
}

FilterBar.propTypes = {
data: PropTypes.object,
onAction: PropTypes.func
}

FilterBar.defaultProps = {
data: {},
onAction: () => {}
}

export default FilterBar
