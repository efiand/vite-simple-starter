const breakpoint = {
	TABLET: 768,
	DESKTOP: 1280,
};

export const media = {
	'mobile': `(max-width: ${breakpoint.TABLET - 1}px)`,
	'tablet-mobile': `(max-width: ${breakpoint.DESKTOP - 1}px)`,
	'tablet-desktop': `(min-width: ${breakpoint.TABLET}px)`,
	'desktop': `(min-width: ${breakpoint.DESKTOP}px)`,
};

export const getData = (page) => {
	return {
		common: {
			isIndex: page === 'index',
		},
		pages: {
			index: {
				title: 'Главная',
			},
			404: {
				title: 'Страница не найдена',
			},
		},
	};
};
