browsers = [ 
    {'env': 'local', 'browser': 'Firefox'},

    {'browser': 'Firefox', 'browser_version': '35.0', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1600x1200'},
    {'browser': 'Firefox', 'browser_version': '33.0', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1600x1200'},
    {'browser': 'Firefox', 'browser_version': '31.0', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1600x1200'},

    {'browser': 'IE', 'browser_version': '11.0', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1600x1200'},
    {'browser': 'IE', 'browser_version': '10.0', 'os': 'Windows', 'os_version': '7', 'resolution': '1024x768'},
    {'browser': 'IE', 'browser_version': '9.0', 'os': 'Windows', 'os_version': '7', 'resolution': '1600x1200'},
    # {'browser': 'IE', 'browser_version': '7.0', 'os': 'Windows', 'os_version': 'XP', 'resolution': '1600x1200'},
    

    {'browser': 'Chrome', 'browser_version': '39.0', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1680x1050'},
    {'browser': 'Chrome', 'browser_version': '36.0', 'os': 'Windows', 'os_version': 'XP', 'resolution': '1600x1200'},

    {'browser': 'Safari', 'browser_version': '5.1', 'os': 'OS X', 'os_version': 'Snow Leopard', 'resolution': '1600x1200'},
    {'browser': 'Safari', 'browser_version': '6.0', 'os': 'OS X', 'os_version': 'Lion', 'resolution': '1024x768'},
    {'browser': 'Safari', 'browser_version': '6.1', 'os': 'OS X', 'os_version': 'Mountain Lion', 'resolution': '1600x1200'},
    {'browser': 'Safari', 'browser_version': '7.0', 'os': 'OS X', 'os_version': 'Mavericks', 'resolution': '1600x1200'},
    {'browser': 'Safari', 'browser_version': '8.0', 'os': 'OS X', 'os_version': 'Yosemite', 'resolution': '1600x1200'},

    {'browserName': 'iPhone', 'platform': 'MAC', 'device': 'iPhone 5S'},
    {'browserName': 'iPhone', 'platform': 'MAC', 'device': 'iPhone 5'},
    {'browserName': 'iPhone', 'platform': 'MAC', 'device': 'iPhone 5C'},

    {'browserName': 'iPad', 'platform': 'MAC', 'device': 'iPad 4th Gen'},
    {'browserName': 'iPad', 'platform': 'MAC', 'device': 'iPad mini Retina'},
    {'browserName': 'iPad', 'platform': 'MAC', 'device': 'iPad Air'},

    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy Tab 4 10.1'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy Note 10.1'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy Note 3'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy Note 2'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy S5'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy S4'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Samsung Galaxy S3'},

    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Sony Xperia Tipo'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'HTC One M8'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Amazon Kindle Fire HDX 7'},

    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus 9'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus 7'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus 6'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus 5'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus 4'},
    {'browserName': 'android', 'platform': 'ANDROID', 'device': 'Google Nexus'},

    {'browser': 'Opera', 'browser_version': '12.16', 'os': 'Windows', 'os_version': '8.1', 'resolution': '1600x1200'},
    {'browser': 'Opera', 'browser_version': '12.15', 'os': 'Windows', 'os_version': '8', 'resolution': '1600x1200'},

]


def fill_env(cap):
    if not cap.has_key('env'):
        cap['env'] = 'remote'
    return cap

browsers = map(fill_env, browsers)


