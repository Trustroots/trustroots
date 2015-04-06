#!/usr/bin/env python

from browsers import browsers


from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import TimeoutException

import time
import sys
import re


test_url = 'https://dev.trustroots.org/'
#test_url = 'http://localhost:3000/'
#test_url = 'http://trustroots.dev/'

class Main:
  def __init__(self):
    try:
        from config_browserstack import browserstack_url
        no_browserstack = 0
    except ImportError:
        no_browserstack = 1
    no_browserstack = 1

    for cap in browsers:
        if cap['env'] == 'remote' and no_browserstack:
            if no_browserstack == 1:
                print 'sorry, no browserstack'
                no_browserstack = 2   # Should be cleaner
        else:
            if cap['env'] == 'local':
                driver = getattr(webdriver, cap['browser'])()
            else:
                print 'launching', cap
                driver = webdriver.Remote(
                    command_executor=browserstack_url,
                    desired_capabilities=cap
                )
            try:
                self.t = TestSuite(driver, cap, test_url)
            except:
                print sys.exc_info
            finally:
                if cap['env'] == 'remote':
                    driver.quit()
            

class TestSuite:
    def __init__(self, driver, cap, url):
        self.wait = WebDriverWait(driver, 15)
        self.driver = driver
        self.cap = cap
        self.url = url
        try:
            self.run_tests()
        except Exception, e:
            print cap, e
        
    def run_tests(self):
        self.driver.get(self.url)
        if not "Trustroots" in self.driver.title:
            raise Exception("Unable to load page!")
        self._wait_and_click(self.driver.find_element_by_css_selector, 'a.btn-home-signup')
        if not 'Trustroots'  in self.driver.title:
            raise Exception("Unable to load page!")

        self._wait_and_click(self.driver.find_element_by_id, 'firstName')
        num = str(time.time())[5:10]
        unique = 'trustroots-test-' + num + '@example.com' 
        self.username = 'tester' + num
        self.driver.find_element_by_id('email').send_keys(unique)
        self.driver.find_element_by_id('firstName').send_keys('Tester')
        self.driver.find_element_by_id('lastName').send_keys('Tester')
        self.driver.find_element_by_id('username').send_keys(self.username)
        self.driver.find_element_by_id('password').send_keys('Tester' + num)
        self._wait_and_click(self.driver.find_element_by_css_selector, 'button.btn-primary span')

        self._wait_and_click(self.driver.find_element_by_id, 'signup-edit')


        # what is wrong with these?
        #self._assert_contains_regexp('find the email from Trustroots')
        #self._assert_contains_regexp('Een uitdaging is gezelliger')
        #self._wait_and_click(self.driver.find_element_by_id, 'delenVerstuur')

        self._wait_and_click(self.driver.find_element_by_css_selector, 'a.navbar-brand')
        self.driver.find_element_by_id('search-query').send_keys('Berlin' + Keys.RETURN)
        # profile stuff
        # self.driver.find_element_by_css_selector("a[href='/#!/profile//edit']").click()
        
    def _assert_contains_regexp(self, regexp):
        text_found = re.search(regexp, self.driver.page_source)
        print text_found
        
        assert text_found != None


    def _wait_and_click_id(self, _id, pause=0):
        self._wait_and_click(self.driver.find_element_by_id, _id, pause)

    def _wait_and_click(self, func, param, pause=0):
        if pause == 0:
            self.wait.until(lambda _: func(param).is_displayed())
        else:
            self._sleep(pause)
        func(param).click()


m = Main()
