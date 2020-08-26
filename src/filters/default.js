import PropTypes from "prop-types";
import React from "react";

class Filter extends React.Component {
  static propTypes = {
    value: PropTypes.string.isRequired,
    icons: PropTypes.object,
    updateFilter: PropTypes.func,
  };

  handleFilterChange = (event) => {
    const newValue = this.filterRef.value;
    this.props.updateFilter(newValue);
  };

  render() {
    return (
      <section>
        <input
          id="filter-input"
          ref={(el) => {
            this.filterRef = el;
          }}
          type="search"
          placeholder="Filter files"
          value={this.props.value}
          onChange={this.handleFilterChange}
        />
        {this.props.value === "" ? (
          <label htmlFor="filter-input">{this.props.icons.Search}</label>
        ) : null}
      </section>
    );
  }
}

export default Filter;
