import React from 'react'
import PropTypes from 'prop-types'
import './StatsHeader.scss'

const StatsHeader = ({ data, onAction }) => {
return (
<div className="StatsHeader">
<h3>StatsHeader Component</h3>
<p>Component implementation goes here</p>
</div>
)
}

StatsHeader.propTypes = {
data: PropTypes.object,
onAction: PropTypes.func
}

StatsHeader.defaultProps = {
data: {},
onAction: () => {}
}

export default StatsHeader
