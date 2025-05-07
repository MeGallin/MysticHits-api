const { getStartOfDay, getStartOfWeek, getDaysAgo } = require('../lib/agg');

describe('Aggregation Helpers', () => {
  describe('getStartOfDay', () => {
    test('should set time to midnight', () => {
      // Create a date at some arbitrary time
      const date = new Date(2023, 0, 15, 14, 30, 45, 500); // Jan 15, 2023, 14:30:45.500
      const startOfDay = getStartOfDay(date);
      
      expect(startOfDay.getFullYear()).toBe(2023);
      expect(startOfDay.getMonth()).toBe(0); // January
      expect(startOfDay.getDate()).toBe(15);
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);
    });
    
    test('should use current date when no parameter is provided', () => {
      const now = new Date();
      const startOfDay = getStartOfDay();
      
      expect(startOfDay.getFullYear()).toBe(now.getFullYear());
      expect(startOfDay.getMonth()).toBe(now.getMonth());
      expect(startOfDay.getDate()).toBe(now.getDate());
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);
    });
  });
  
  describe('getStartOfWeek', () => {
    test('should get start of week (Sunday) for a date in the middle of the week', () => {
      // Create a date for Wednesday, Jan 18, 2023
      const wednesday = new Date(2023, 0, 18, 12, 0, 0); 
      const startOfWeek = getStartOfWeek(wednesday);
      
      // Should be Sunday, Jan 15, 2023, 00:00:00.000
      expect(startOfWeek.getFullYear()).toBe(2023);
      expect(startOfWeek.getMonth()).toBe(0);
      expect(startOfWeek.getDate()).toBe(15);
      expect(startOfWeek.getDay()).toBe(0); // Sunday
      expect(startOfWeek.getHours()).toBe(0);
      expect(startOfWeek.getMinutes()).toBe(0);
      expect(startOfWeek.getSeconds()).toBe(0);
      expect(startOfWeek.getMilliseconds()).toBe(0);
    });
    
    test('should return the same day if already Sunday', () => {
      // Create a date for Sunday, Jan 15, 2023, but at some time during the day
      const sunday = new Date(2023, 0, 15, 18, 30, 0);
      const startOfWeek = getStartOfWeek(sunday);
      
      // Should be Sunday, Jan 15, 2023, 00:00:00.000
      expect(startOfWeek.getFullYear()).toBe(2023);
      expect(startOfWeek.getMonth()).toBe(0);
      expect(startOfWeek.getDate()).toBe(15);
      expect(startOfWeek.getDay()).toBe(0); // Sunday
      expect(startOfWeek.getHours()).toBe(0);
      expect(startOfWeek.getMinutes()).toBe(0);
      expect(startOfWeek.getSeconds()).toBe(0);
      expect(startOfWeek.getMilliseconds()).toBe(0);
    });
  });
  
  describe('getDaysAgo', () => {
    test('should get the date N days ago', () => {
      // Create a specific date
      const date = new Date(2023, 0, 15); // Jan 15, 2023
      const sevenDaysAgo = getDaysAgo(7, date);
      
      // Should be Jan 8, 2023
      expect(sevenDaysAgo.getFullYear()).toBe(2023);
      expect(sevenDaysAgo.getMonth()).toBe(0);
      expect(sevenDaysAgo.getDate()).toBe(8);
    });
    
    test('should handle month/year boundaries correctly', () => {
      // Create Jan 1, 2023
      const janFirst = new Date(2023, 0, 1);
      const twoDaysAgo = getDaysAgo(2, janFirst);
      
      // Should be Dec 30, 2022
      expect(twoDaysAgo.getFullYear()).toBe(2022);
      expect(twoDaysAgo.getMonth()).toBe(11); // December
      expect(twoDaysAgo.getDate()).toBe(30);
    });
  });
});