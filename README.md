# useCurrentDate

A simple utility hook for React that stores and provides the current date as state.  When the date changes, the component renders.

Under the hood, it uses [Moment.js](https://momentjs.com).  The return type can be specified to a `Date` (default), a `Moment`, or a formatted string using the [`moment.format()`](https://momentjs.com/docs/#/displaying/format/) syntax.

## Installation

You can install the package using either npm or yarn.

### npm

```bash
npm install use-current-date
```

### yarn

```bash
yarn add use-current-date
```

## Usage

Here's an example of how you can use the `useCurrentDate` hook in your React component:

```jsx
import React from 'react';
import useCurrentDate from 'use-current-date';

const MyComponent = () => {
  const currentDate = useCurrentDate();

  return (
    <div>
      <h1>Current Date</h1>
      <p>{currentDate.toDateString()}</p>
    </div>
  );
};

export default MyComponent;
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/dfoverdx/use-current-date).

Please make sure to follow the [Contributor's Guide](CONTRIBUTING.md) when submitting pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
```

Feel free to modify the content to suit your specific package or add any additional sections you deem necessary.